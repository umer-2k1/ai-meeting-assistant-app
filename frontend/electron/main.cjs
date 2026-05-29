const fs = require('node:fs');
const path = require('node:path');
const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  globalShortcut,
  ipcMain,
  screen,
  nativeImage,
  shell,
  session,
  systemPreferences,
  desktopCapturer,
} = require('electron');

const permissions = require('./permissions.cjs');
const AudioRecordingService = require('./audio-recording-service.cjs');

const APP_NAME = 'AI Meeting Copilot';
const DESKTOP_PROTOCOL = process.env.DESKTOP_PROTOCOL || 'ai-meeting-copilot';

const isTestMode = process.env.ELECTRON_TEST_MODE === '1';

// Initialize audio recording service
const audioService = new AudioRecordingService();

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
  elapsedSeconds: 0,
  startTime: null,
};

let recordingTimer = null;

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

function registerDeepLinking() {
  // Register custom protocol for OAuth callback.
  try {
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(DESKTOP_PROTOCOL, process.execPath, [process.argv[1]]);
      }
    } else {
      app.setAsDefaultProtocolClient(DESKTOP_PROTOCOL);
    }
  } catch (error) {
    console.warn('[desktop] Failed to register protocol client', error);
  }

  // macOS deep link handler
  app.on('open-url', (event, url) => {
    event.preventDefault();
    emit('auth:callback', { url });
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Windows/Linux deep link handler (second instance)
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on('second-instance', (_event, argv) => {
    const deepLink = argv.find((arg) => typeof arg === 'string' && arg.startsWith(`${DESKTOP_PROTOCOL}://`));
    if (deepLink) {
      emit('auth:callback', { url: deepLink });
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
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
  // Start elapsed time tracker
  if (!recordingTimer) {
    recordingState.startTime = Date.now();
    recordingTimer = setInterval(() => {
      if (!recordingState.isRecording || recordingState.isPaused) return;
      recordingState.elapsedSeconds = Math.floor((Date.now() - recordingState.startTime) / 1000);
      emitRecordingState();
    }, 1000);
  }
}

function clearRecordingTimers() {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  recordingState.startTime = null;
}

async function startRecording() {
  try {
    const meetingId = `meeting-${Date.now()}`;
    
    // Start audio recording with Deepgram
    await audioService.startRecording(meetingId, {
      onTranscript: (transcriptLine) => {
        // Emit transcript to renderer
        emit('recording:transcript', transcriptLine);
      },
      onError: (error) => {
        console.error('[Recording] Error:', error);
      },
    });

    recordingState.isRecording = true;
    recordingState.isPaused = false;
    startRecordingTimers();
    emitRecordingStateAndSyncWidget();
    
    return { ...recordingState };
  } catch (error) {
    console.error('[Recording] Failed to start:', error);
    return {
      ...recordingState,
      error: error.message,
    };
  }
}

function pauseResumeRecording() {
  if (!recordingState.isRecording) return { ...recordingState };
  
  recordingState.isPaused = !recordingState.isPaused;
  
  if (recordingState.isPaused) {
    audioService.pauseRecording();
  } else {
    audioService.resumeRecording();
  }
  
  emitRecordingState();
  return { ...recordingState };
}

async function stopRecording() {
  try {
    // Stop audio service
    const result = await audioService.stopRecording();
    
    recordingState.isRecording = false;
    recordingState.isPaused = false;
    recordingState.elapsedSeconds = 0;
    clearRecordingTimers();
    emitRecordingStateAndSyncWidget();
    
    return {
      ...recordingState,
      recordingPath: result.recordingPath,
    };
  } catch (error) {
    console.error('[Recording] Failed to stop:', error);
    recordingState.isRecording = false;
    recordingState.isPaused = false;
    recordingState.elapsedSeconds = 0;
    clearRecordingTimers();
    emitRecordingStateAndSyncWidget();
    
    return { ...recordingState, error: error.message };
  }
}

function shouldOpenAuthInSystemBrowser(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  if (urlString.startsWith(`${DESKTOP_PROTOCOL}://`)) return false;

  try {
    const url = new URL(urlString);
    if (url.hostname === 'accounts.google.com') return true;
    if (url.pathname.includes('/auth/google')) return true;
    return false;
  } catch {
    return false;
  }
}

function openAuthInSystemBrowser(urlString) {
  let target = urlString;
  if (target.includes('/auth/google') && !target.includes('source=desktop')) {
    target += target.includes('?') ? '&source=desktop' : '?source=desktop';
  }
  void shell.openExternal(target);
}

function attachSystemBrowserForOAuth(win) {
  win.webContents.on('will-navigate', (event, url) => {
    if (shouldOpenAuthInSystemBrowser(url)) {
      event.preventDefault();
      openAuthInSystemBrowser(url);
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenAuthInSystemBrowser(url)) {
      openAuthInSystemBrowser(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
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

  attachSystemBrowserForOAuth(mainWindow);

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

function configureMediaSessionPermissions() {
  const ses = session.defaultSession;
  const mediaPermissions = new Set(['media', 'audioCapture', 'videoCapture', 'clipboard-read']);

  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (mediaPermissions.has(permission)) {
      callback(true);
      return;
    }
    callback(false);
  });

  ses.setPermissionCheckHandler((_webContents, permission) => {
    if (!mediaPermissions.has(permission)) {
      return false;
    }

    if (process.platform === 'darwin' || process.platform === 'win32') {
      const status = systemPreferences.getMediaAccessStatus?.('microphone');
      if (status === 'granted') return true;
      if (status === 'not-determined') return true;
      return false;
    }

    return true;
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

  ipcMain.handle('desktop:permissions:request-notifications', async () =>
    permissions.requestNotificationPermission()
  );

  ipcMain.handle('desktop:permissions:open-settings', (_event, target) =>
    permissions.openPermissionSettings(target)
  );

  ipcMain.handle('desktop:device-check:list-capture-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      fetchWindowIcons: false,
    });

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      displayId: source.display_id,
    }));
  });

  ipcMain.handle('desktop:recording:start', async () => {
    const access = await permissions.ensureRecordingPermissions();
    if (!access.ok) {
      return {
        ...recordingState,
        blockedReason: access.blockedReason,
        permissionStatus: access.permissionStatus,
      };
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

  ipcMain.handle('desktop:open-external', async (_event, url) => {
    try {
      await shell.openExternal(String(url));
      return { ok: true };
    } catch (error) {
      console.error('[desktop] openExternal failed', error);
      return { ok: false };
    }
  });
}

app.setName(APP_NAME);

if (process.platform === 'win32') {
  app.setAppUserModelId('com.aimmeetingcopilot.desktop');
}

app.whenReady().then(() => {
  configureMediaSessionPermissions();
  registerIpcHandlers();
  registerDeepLinking();
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
