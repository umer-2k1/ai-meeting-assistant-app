const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain, screen, nativeImage } = require('electron');

const permissions = require('./permissions.cjs');

const APP_NAME = 'AI Meeting Copilot';

const isTestMode = process.env.ELECTRON_TEST_MODE === '1';

const WIDGET_SIZES = {
  compact: { width: 300, height: 52 },
  expanded: { width: 480, height: 680 }
};

const WIDGET_EXPANDED_MIN = { width: 380, height: 520 };

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let widgetWindow = null;
/** @type {Tray | null} */
let tray = null;

let widgetExpanded = false;
let widgetUserPlaced = false;
/** @type {{ winX: number; winY: number; cursorX: number; cursorY: number } | null} */
let widgetDragState = null;
/** @type {{ edge: string; startWidth: number; startHeight: number; cursorX: number; cursorY: number } | null} */
let widgetResizeState = null;
let widgetExpandedSize = { ...WIDGET_SIZES.expanded };

const recordingState = {
  isRecording: false,
  isPaused: false,
  elapsedSeconds: 0
};

let recordingTimer = null;
let transcriptTimer = null;
let transcriptIndex = 0;

const transcriptTemplates = [
  { speaker: 'John Martinez', text: "Let's align on Q3 launch priorities and risk mitigation." },
  { speaker: 'Sarah Chen', text: 'We should keep monitoring mobile API latency daily.' },
  { speaker: 'Marcus Wong', text: 'Action item: publish the release readiness checklist by Friday.' },
  { speaker: 'John Martinez', text: 'Decision: Dark Mode ships in Q3 with phased rollout.' }
];

function resolveAppIconPath() {
  const iconsDir = path.join(__dirname, 'icons');

  if (process.platform === 'win32') {
    const icoPath = path.join(iconsDir, 'icon.ico');
    if (fs.existsSync(icoPath)) return icoPath;
  }

  if (process.platform === 'darwin') {
    const icnsPath = path.join(iconsDir, 'icon.icns');
    if (fs.existsSync(icnsPath)) return icnsPath;
  }

  const pngPath = path.join(iconsDir, 'icon.png');
  if (fs.existsSync(pngPath)) return pngPath;

  const fallbackWebp = path.join(__dirname, '..', 'public', 'favicon', 'favicon-512.webp');
  if (fs.existsSync(fallbackWebp)) return fallbackWebp;

  return null;
}

function loadAppIconImage() {
  const iconPath = resolveAppIconPath();
  if (!iconPath) return null;

  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    console.warn('[desktop] Failed to load app icon from', iconPath);
    return null;
  }

  return image;
}

function applyWindowIcon(win) {
  if (!win || win.isDestroyed()) return;

  const image = loadAppIconImage();
  if (!image) return;

  win.setIcon(image);
}

function applyDockIcon() {
  if (process.platform !== 'darwin' || !app.dock) return;

  const image = loadAppIconImage();
  if (!image) return;

  app.dock.setIcon(image);
  app.dock.show();
}

function formatTimestamp(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `00:${mm}:${ss}`;
}

function emit(channel, payload) {
  for (const win of [mainWindow, widgetWindow]) {
    if (!win || win.isDestroyed()) continue;
    win.webContents.send(channel, payload);
  }
}

function emitRecordingState() {
  emit('recording:state', { ...recordingState });
}

function emitRecordingStateAndSyncWidget() {
  emitRecordingState();
  syncWidgetVisibility();
}

function ensureWidgetWindow() {
  if (isTestMode) return;
  if (!widgetWindow || widgetWindow.isDestroyed()) {
    createWidgetWindow();
  }
}

function syncWidgetVisibility() {
  if (isTestMode) return;

  if (!recordingState.isRecording) {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      if (widgetExpanded) {
        resizeWidgetWindow(false);
      }
      widgetWindow.hide();
    }
    widgetUserPlaced = false;
    widgetDragState = null;
    widgetResizeState = null;
    return;
  }

  ensureWidgetWindow();
  if (!widgetWindow || widgetWindow.isDestroyed()) return;

  if (!widgetUserPlaced) {
    positionWidgetBottomRight();
  }

  if (!widgetWindow.isVisible()) {
    widgetWindow.show();
  }
}

function startRecordingTimers() {
  if (!recordingTimer) {
    recordingTimer = setInterval(() => {
      if (!recordingState.isRecording || recordingState.isPaused) return;
      recordingState.elapsedSeconds += 1;
      emitRecordingState();
    }, 1000);
  }

  if (!transcriptTimer) {
    transcriptTimer = setInterval(() => {
      if (!recordingState.isRecording || recordingState.isPaused) return;

      const template = transcriptTemplates[transcriptIndex % transcriptTemplates.length];
      transcriptIndex += 1;

      emit('recording:transcript', {
        id: `desktop-line-${Date.now()}`,
        timestamp: formatTimestamp(recordingState.elapsedSeconds),
        speaker: template.speaker,
        text: template.text,
        highlighted: transcriptIndex % 4 === 0
      });
    }, 4500);
  }
}

function clearRecordingTimers() {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }

  if (transcriptTimer) {
    clearInterval(transcriptTimer);
    transcriptTimer = null;
  }
}

function startRecording() {
  recordingState.isRecording = true;
  recordingState.isPaused = false;
  startRecordingTimers();
  emitRecordingStateAndSyncWidget();
  return { ...recordingState };
}

function pauseResumeRecording() {
  if (!recordingState.isRecording) return { ...recordingState };
  recordingState.isPaused = !recordingState.isPaused;
  emitRecordingState();
  return { ...recordingState };
}

function stopRecording() {
  recordingState.isRecording = false;
  recordingState.isPaused = false;
  recordingState.elapsedSeconds = 0;
  clearRecordingTimers();
  emitRecordingStateAndSyncWidget();
  return { ...recordingState };
}

function createMainWindow() {
  const iconPath = resolveAppIconPath();

  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: '#050A1A',
    title: APP_NAME,
    show: false,
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (isTestMode) {
    mainWindow.loadURL('data:text/html,<html><body><h1>AI Meeting Copilot Test</h1></body></html>');
  } else if (devUrl) {
    mainWindow.loadURL(devUrl);
    if (process.env.ELECTRON_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    applyWindowIcon(mainWindow);
    applyDockIcon();
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function loadWidgetContent(win) {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(`${devUrl}/widget.html`);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'widget.html'));
  }
}

function positionWidgetBottomRight() {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;

  const { workArea } = screen.getPrimaryDisplay();
  const bounds = widgetWindow.getBounds();
  const x = workArea.x + workArea.width - bounds.width - 24;
  const y = workArea.y + workArea.height - bounds.height - 24;
  widgetWindow.setPosition(x, y);
}

function getWidgetWorkArea() {
  return screen.getPrimaryDisplay().workArea;
}

function getWidgetExpandedLimits() {
  const workArea = getWidgetWorkArea();
  return {
    minWidth: WIDGET_EXPANDED_MIN.width,
    minHeight: WIDGET_EXPANDED_MIN.height,
    maxWidth: workArea.width - 24,
    maxHeight: workArea.height - 24
  };
}

function clampExpandedSize(width, height) {
  const limits = getWidgetExpandedLimits();
  return {
    width: Math.round(Math.min(Math.max(width, limits.minWidth), limits.maxWidth)),
    height: Math.round(Math.min(Math.max(height, limits.minHeight), limits.maxHeight))
  };
}

function applyWidgetBounds(size, { anchorBottom = true } = {}) {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;

  const workArea = getWidgetWorkArea();
  const oldBounds = widgetWindow.getBounds();
  let nextX = oldBounds.x;
  let nextY = anchorBottom ? oldBounds.y + oldBounds.height - size.height : oldBounds.y;

  if (nextX + size.width > workArea.x + workArea.width) {
    nextX = workArea.x + workArea.width - size.width;
  }
  if (nextX < workArea.x) {
    nextX = workArea.x;
  }

  if (nextY + size.height > workArea.y + workArea.height) {
    nextY = workArea.y + workArea.height - size.height;
  }
  if (nextY < workArea.y) {
    nextY = workArea.y;
  }

  widgetWindow.setBounds(
    {
      x: Math.round(nextX),
      y: Math.round(nextY),
      width: size.width,
      height: size.height
    },
    false
  );
}

function resizeWidgetWindow(expanded) {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;

  widgetExpanded = expanded;

  if (expanded) {
    widgetExpandedSize = clampExpandedSize(widgetExpandedSize.width, widgetExpandedSize.height);
    applyWidgetBounds(widgetExpandedSize, { anchorBottom: true });
    return;
  }

  applyWidgetBounds(WIDGET_SIZES.compact, { anchorBottom: true });
}

function workAreaMinY() {
  return getWidgetWorkArea().y;
}

function createWidgetWindow() {
  if (isTestMode) return;

  widgetWindow = new BrowserWindow({
    width: WIDGET_SIZES.compact.width,
    height: WIDGET_SIZES.compact.height,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.platform === 'darwin') {
    widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    widgetWindow.setAlwaysOnTop(true, 'floating');
  }

  loadWidgetContent(widgetWindow);

  widgetWindow.once('ready-to-show', () => {
    if (!widgetUserPlaced) {
      positionWidgetBottomRight();
    }
    if (recordingState.isRecording) {
      widgetWindow.show();
    }
    emit('recording:state', { ...recordingState });
  });

  widgetWindow.on('closed', () => {
    widgetWindow = null;
    widgetExpanded = false;
  });
}

function createTray() {
  const iconImage = loadAppIconImage();
  if (!iconImage) {
    console.warn('[desktop] Tray icon unavailable — run pnpm check:electron to generate icons.');
    return;
  }

  tray = new Tray(iconImage.resize({ width: 22, height: 22 }));
  tray.setToolTip(APP_NAME);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (!mainWindow) createMainWindow();
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Show Floating Widget',
      enabled: recordingState.isRecording,
      click: () => {
        if (!recordingState.isRecording) return;
        ensureWidgetWindow();
        if (widgetWindow) {
          if (!widgetUserPlaced) {
            positionWidgetBottomRight();
          }
          widgetWindow.show();
        }
      }
    },
    {
      label: 'Start Recording',
      click: () => {
        startRecording();
      }
    },
    {
      label: 'Stop Recording',
      click: () => {
        stopRecording();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
}

function registerGlobalShortcuts() {
  globalShortcut.register('CommandOrControl+K', () => {
    if (recordingState.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });
}

function registerIpcHandlers() {
  ipcMain.handle('desktop:app-info', () => ({
    platform: process.platform,
    versions: process.versions
  }));

  ipcMain.handle('desktop:permissions:get-all', () => permissions.getAllPermissions());

  ipcMain.handle('desktop:permissions:request-microphone', async () =>
    permissions.requestMicrophonePermission()
  );

  ipcMain.handle('desktop:permissions:request-accessibility', () =>
    permissions.requestAccessibilityPermission()
  );

  ipcMain.handle('desktop:permissions:open-settings', (_event, target) =>
    permissions.openPermissionSettings(target)
  );

  ipcMain.handle('desktop:recording:start', async () => {
    const mic = permissions.getMicrophonePermission();
    if (!mic.granted) {
      const result = await permissions.requestMicrophonePermission();
      if (!result.granted) {
        return {
          ...recordingState,
          blockedReason: 'microphone',
          permissionStatus: result.status
        };
      }
    }

    return startRecording();
  });
  ipcMain.handle('desktop:recording:pause-resume', () => pauseResumeRecording());
  ipcMain.handle('desktop:recording:stop', () => stopRecording());
  ipcMain.handle('desktop:recording:status', () => ({ ...recordingState }));

  ipcMain.handle('desktop:widget:set-expanded', (_event, expanded) => {
    resizeWidgetWindow(Boolean(expanded));
    return {
      expanded: widgetExpanded,
      size: widgetExpanded ? widgetExpandedSize : WIDGET_SIZES.compact,
      limits: widgetExpanded ? getWidgetExpandedLimits() : null
    };
  });

  ipcMain.handle('desktop:widget:open-main', () => {
    if (!mainWindow) createMainWindow();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
    return { ok: true };
  });

  ipcMain.handle('desktop:widget:drag-start', () => {
    if (!widgetWindow || widgetWindow.isDestroyed()) {
      return { ok: false };
    }

    const [winX, winY] = widgetWindow.getPosition();
    const cursor = screen.getCursorScreenPoint();
    widgetDragState = { winX, winY, cursorX: cursor.x, cursorY: cursor.y };
    return { ok: true };
  });

  ipcMain.handle('desktop:widget:drag-move', () => {
    if (!widgetWindow || widgetWindow.isDestroyed() || !widgetDragState) {
      return { ok: false };
    }

    const cursor = screen.getCursorScreenPoint();
    const dx = cursor.x - widgetDragState.cursorX;
    const dy = cursor.y - widgetDragState.cursorY;
    const nextX = Math.round(widgetDragState.winX + dx);
    const nextY = Math.round(widgetDragState.winY + dy);

    widgetWindow.setPosition(nextX, nextY);
    widgetUserPlaced = true;
    return { ok: true };
  });

  ipcMain.handle('desktop:widget:drag-end', () => {
    widgetDragState = null;
    return { ok: true };
  });

  ipcMain.handle('desktop:widget:resize-start', (_event, edge = 'corner') => {
    if (!widgetWindow || widgetWindow.isDestroyed() || !widgetExpanded) {
      return { ok: false };
    }

    const bounds = widgetWindow.getBounds();
    const cursor = screen.getCursorScreenPoint();
    widgetResizeState = {
      edge,
      startWidth: bounds.width,
      startHeight: bounds.height,
      cursorX: cursor.x,
      cursorY: cursor.y
    };

    return { ok: true, limits: getWidgetExpandedLimits() };
  });

  ipcMain.handle('desktop:widget:resize-move', () => {
    if (!widgetWindow || widgetWindow.isDestroyed() || !widgetResizeState) {
      return { ok: false };
    }

    const cursor = screen.getCursorScreenPoint();
    const dx = cursor.x - widgetResizeState.cursorX;
    const dy = cursor.y - widgetResizeState.cursorY;

    let nextWidth = widgetResizeState.startWidth;
    let nextHeight = widgetResizeState.startHeight;

    if (widgetResizeState.edge === 'corner' || widgetResizeState.edge === 'right') {
      nextWidth = widgetResizeState.startWidth + dx;
    }
    if (widgetResizeState.edge === 'corner' || widgetResizeState.edge === 'bottom') {
      nextHeight = widgetResizeState.startHeight + dy;
    }

    widgetExpandedSize = clampExpandedSize(nextWidth, nextHeight);
    applyWidgetBounds(widgetExpandedSize, { anchorBottom: false });
    widgetUserPlaced = true;

    return { ok: true, size: widgetExpandedSize, limits: getWidgetExpandedLimits() };
  });

  ipcMain.handle('desktop:widget:resize-end', () => {
    widgetResizeState = null;
    return { ok: true };
  });

  ipcMain.handle('desktop:theme:broadcast', (_event, preference) => {
    emit('theme:changed', preference);
    return { ok: true };
  });
}

app.setName(APP_NAME);

if (process.platform === 'win32') {
  app.setAppUserModelId('com.aimmeetingcopilot.desktop');
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();
  applyDockIcon();
  if (!isTestMode) {
    createWidgetWindow();
    createTray();
  }
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      createWidgetWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
