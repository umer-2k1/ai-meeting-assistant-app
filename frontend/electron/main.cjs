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
} = require('electron');

const permissions = require('./permissions.cjs');
// NOTE: Audio capture happens in the renderer (getUserMedia/getDisplayMedia →
// MediaRecorder → WebSocket → Deepgram). The main process only tracks recording
// state for the widget/tray/timer. See use-live-transcription.ts.

const APP_NAME = 'AI Meeting Copilot';
const DESKTOP_PROTOCOL = process.env.DESKTOP_PROTOCOL || 'ai-meeting-copilot';

// Electron 39+ on macOS 14.2+ uses CoreAudio Tap API by default.
// This requires NSAudioCaptureUsageDescription in Info.plist (handled by patch-electron-plist.mjs).
// CoreAudio Tap gives us "System Audio Recording Only" permission instead of "Screen & System Audio Recording".

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
/** True once the widget renderer has painted (ready-to-show) — gates show(). */
let widgetContentReady = false;
/** @type {{ winX: number; winY: number; cursorX: number; cursorY: number } | null} */
let widgetDragState = null;
/** @type {{ edge: string; startWidth: number; startHeight: number; cursorX: number; cursorY: number } | null} */
let widgetResizeState = null;
let widgetExpandedSize = { ...WIDGET_SIZES.expanded };

// ---- Widget position persistence (survives app restarts) ----

function widgetPrefsPath() {
  return path.join(app.getPath('userData'), 'widget-prefs.json');
}

/** @type {{ x: number; y: number } | null} */
let savedWidgetPosition = null;
/** @type {NodeJS.Timeout | null} */
let widgetPrefsSaveTimer = null;

function loadWidgetPrefs() {
  try {
    const raw = fs.readFileSync(widgetPrefsPath(), 'utf8');
    const prefs = JSON.parse(raw);
    if (
      prefs &&
      typeof prefs.x === 'number' &&
      typeof prefs.y === 'number' &&
      Number.isFinite(prefs.x) &&
      Number.isFinite(prefs.y)
    ) {
      savedWidgetPosition = { x: Math.round(prefs.x), y: Math.round(prefs.y) };
    }
    if (prefs && prefs.expandedSize) {
      const { width, height } = prefs.expandedSize;
      if (typeof width === 'number' && typeof height === 'number') {
        widgetExpandedSize = { width: Math.round(width), height: Math.round(height) };
      }
    }
  } catch {
    // No prefs yet (first run) or unreadable file — defaults apply.
  }
}

/** Debounced write — drag/resize fire per mouse-move. */
function saveWidgetPrefs() {
  if (widgetPrefsSaveTimer) clearTimeout(widgetPrefsSaveTimer);
  widgetPrefsSaveTimer = setTimeout(() => {
    widgetPrefsSaveTimer = null;
    try {
      fs.writeFileSync(
        widgetPrefsPath(),
        JSON.stringify({ ...savedWidgetPosition, expandedSize: widgetExpandedSize })
      );
    } catch (error) {
      console.warn('[desktop] Failed to save widget prefs', error);
    }
  }, 400);
}

/**
 * Apply the saved widget position if it is still (mostly) on a visible
 * display; otherwise fall back to the default bottom-right anchor.
 */
function applySavedWidgetPosition() {
  if (!savedWidgetPosition || !widgetWindow || widgetWindow.isDestroyed()) return false;

  const { x, y } = savedWidgetPosition;
  const bounds = widgetWindow.getBounds();
  const display = screen.getDisplayMatching({ x, y, width: bounds.width, height: bounds.height });
  const area = display.workArea;
  const clampedX = Math.min(Math.max(x, area.x), area.x + area.width - bounds.width);
  const clampedY = Math.min(Math.max(y, area.y), area.y + area.height - bounds.height);
  widgetWindow.setPosition(Math.round(clampedX), Math.round(clampedY));
  widgetUserPlaced = true;
  return true;
}

const recordingState = {
  isRecording: false,
  isPaused: false,
  elapsedSeconds: 0,
  startTime: null,
};

let recordingTimer = null;

/** Deep link received before the app/window is ready (macOS fires open-url early). */
let pendingAuthDeepLink = null;
/** Auth callback waiting for the renderer to subscribe (avoids lost IPC events). */
let pendingAuthCallback = null;

function isAuthDeepLink(url) {
  if (typeof url !== 'string' || !url.startsWith(`${DESKTOP_PROTOCOL}://`)) return false;
  return url.includes('auth/callback') || url.includes('integrations/callback');
}

function handleAuthDeepLink(url) {
  console.log('[desktop][deeplink] handleAuthDeepLink', url, 'recognized:', isAuthDeepLink(url));
  if (!isAuthDeepLink(url)) return;

  pendingAuthDeepLink = null;
  pendingAuthCallback = { url };
  emit('auth:callback', { url });

  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
}

function flushPendingAuthDeepLink() {
  if (pendingAuthDeepLink) {
    handleAuthDeepLink(pendingAuthDeepLink);
  }
}

function findAuthDeepLinkInArgv(argv) {
  return argv.find((arg) => isAuthDeepLink(arg));
}

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
  const iconsDir = path.join(__dirname, 'icons');

  // nativeImage (tray/dock/window) needs a raster it can actually decode. Electron's
  // .icns decoder chokes on iconutil-produced PNG-compressed (ic12) files — it returns an
  // empty image — so prefer the raw PNG here. The .icns stays reserved for packaging, where
  // macOS itself parses the .app bundle icon. Try each candidate until one decodes.
  const candidates = [
    path.join(iconsDir, 'icon.png'),
    path.join(__dirname, '..', 'public', 'favicon', 'favicon-512.webp'),
    process.platform === 'darwin' ? path.join(iconsDir, 'icon.icns') : null,
    process.platform === 'win32' ? path.join(iconsDir, 'icon.ico') : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const image = nativeImage.createFromPath(candidate);
    if (!image.isEmpty()) return image;
  }

  console.warn('[desktop] Failed to load app icon from', candidates.join(', '));
  return null;
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

  // Windows/Linux deep link handler (second instance)
  app.on('second-instance', (_event, argv) => {
    const deepLink = findAuthDeepLinkInArgv(argv);
    if (deepLink) {
      handleAuthDeepLink(deepLink);
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

  if (!widgetUserPlaced && !applySavedWidgetPosition()) {
    positionWidgetBottomRight();
  }

  // Show only after first paint; otherwise the ready-to-show handler will show
  // it (prevents a blank transparent window flashing before React mounts).
  if (widgetContentReady && !widgetWindow.isVisible()) {
    widgetWindow.showInactive();
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
    // By design, the main process only TRACKS recording state (for the widget
    // timer, tray, and global shortcut). The actual audio capture + streaming to
    // Deepgram happens in the renderer (getUserMedia/getDisplayMedia →
    // MediaRecorder → WebSocket). See use-live-transcription.ts. So there is no
    // audio work to do here — just flip state on and start the timer.
    recordingState.isRecording = true;
    recordingState.isPaused = false;
    startRecordingTimers();
    emitRecordingStateAndSyncWidget();

    return { ...recordingState };
  } catch (error) {
    console.error('[Recording] Failed to start:', error);
    return {
      ...recordingState,
      error: error.message || 'Failed to start recording'
    };
  }
}

function pauseResumeRecording() {
  if (!recordingState.isRecording) return { ...recordingState };
  
  recordingState.isPaused = !recordingState.isPaused;

  // State-only: the renderer pauses/resumes the real MediaRecorder; here we just
  // track the flag so the widget/tray/timer stay in sync.

  emitRecordingState();
  return { ...recordingState };
}

async function stopRecording() {
  try {
    // State-only: the renderer stops the real MediaRecorder and finalizes the
    // meeting. Here we just clear state so the widget/tray/timer reset.
    recordingState.isRecording = false;
    recordingState.isPaused = false;
    recordingState.elapsedSeconds = 0;
    clearRecordingTimers();
    emitRecordingStateAndSyncWidget();
    
    return {
      ...recordingState,
      recordingPath: null,
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

function isWidgetUrl(urlString) {
  return typeof urlString === 'string' && urlString.includes('widget.html');
}

/**
 * The widget window must never leave widget.html. Any navigation away swaps the
 * transparent overlay for an opaque full-window app page — which reads on screen
 * as a big black box with the pill floating in it. The renderer no longer
 * redirects on 401 (see api-client.ts), and this is the backstop that keeps it
 * that way regardless of what future code does.
 */
function lockWidgetToItsOwnPage(win) {
  win.webContents.on('will-navigate', (event, url) => {
    if (isWidgetUrl(url)) return;
    event.preventDefault();
    console.warn('[desktop][widget] blocked navigation away from widget.html →', url);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    console.warn('[desktop][widget] blocked window.open from the overlay →', url);
    return { action: 'deny' };
  });
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

  // Always create the widget in the compact state. Without this a stale
  // `widgetExpanded` (left over from a previous window) could pair a large
  // window with the compact pill — a giant transparent window that reads as a
  // big black rectangle with the pill floating in its centre.
  widgetExpanded = false;

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

  // Float above everything — including full-screen apps and the menu bar — and
  // stay present across all Spaces, so the widget is genuinely a screen-wide
  // overlay rather than something tied to one window/desktop.
  widgetWindow.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') {
    widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  lockWidgetToItsOwnPage(widgetWindow);
  loadWidgetContent(widgetWindow);

  // Only show once the renderer has actually painted — showing a transparent
  // window before first paint is what left a blank/empty overlay on screen.
  // A fresh renderer ALWAYS mounts collapsed (React state starts false), so any
  // load/reload makes "expanded" stale by definition. The window outlives the
  // renderer — it is only hidden between recordings — so without this the main
  // process can keep an expanded-sized window behind a compact pill, which macOS
  // paints as a full-screen black rectangle with the pill floating in it.
  // This fires on every load, unlike the create-time reset below it.
  widgetWindow.webContents.on('did-finish-load', () => {
    if (widgetExpanded) {
      console.warn('[desktop][widget] renderer reloaded while expanded — collapsing to match');
    }
    widgetExpanded = false;
    applyWidgetBounds(WIDGET_SIZES.compact, { anchorBottom: true });
  });

  widgetWindow.once('ready-to-show', () => {
    widgetContentReady = true;
    if (!widgetUserPlaced && !applySavedWidgetPosition()) {
      positionWidgetBottomRight();
    }
    if (recordingState.isRecording) {
      widgetWindow.showInactive();
    }
    emit('recording:state', { ...recordingState });
  });

  widgetWindow.on('closed', () => {
    widgetWindow = null;
    widgetExpanded = false;
    widgetContentReady = false;
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
      const micStatus = systemPreferences.getMediaAccessStatus?.('microphone');
      if (micStatus === 'granted') return true;
      if (micStatus === 'not-determined') return true;

      return false;
    }

    return true;
  });

  ses.setDisplayMediaRequestHandler(
    (_request, callback) => {
      // System Audio Recording Only via CoreAudio Tap: audio loopback, no video/screen.
      // This avoids desktopCapturer.getSources() (which fails on macOS 26) and triggers
      // the "System Audio Recording Only" permission prompt instead of screen capture.
      callback({ audio: 'loopback' });
    },
    { useSystemPicker: false }
  );
}

function registerIpcHandlers() {
  ipcMain.handle('desktop:app-info', () => {
    const execPath = process.execPath;
    const isPackaged = app.isPackaged;
    const displayName = app.getName();

    let settingsAppName = displayName;
    if (process.platform === 'darwin' && !isPackaged) {
      settingsAppName = 'Electron';
    }

    return {
      platform: process.platform,
      versions: process.versions,
      name: displayName,
      execPath,
      isPackaged,
      settingsAppName,
    };
  });

  ipcMain.handle('desktop:permissions:get-all', async () =>
    permissions.getAllPermissions()
  );

  ipcMain.handle('desktop:permissions:get-settings', async () =>
    permissions.getSettingsPermissions()
  );

  ipcMain.handle('desktop:permissions:request-microphone', async () =>
    permissions.requestMicrophonePermission()
  );

  ipcMain.handle('desktop:permissions:request-accessibility', () =>
    permissions.requestAccessibilityPermission()
  );

  ipcMain.handle('desktop:permissions:request-notifications', async () =>
    permissions.requestNotificationPermission()
  );

  ipcMain.handle('desktop:permissions:open-settings', (_event, target) =>
    permissions.openPermissionSettings(target)
  );

  ipcMain.handle('desktop:device-check:list-capture-sources', async () => {
    // System Audio Recording Only does not need a screen/window source list.
    // We capture system audio via getDisplayMedia loopback in the renderer.
    return {
      sources: [],
      screenPermission: 'granted',
    };
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

  // Live transcript relay: the capturing window (main app) owns the Deepgram WS
  // stream; forward each line to the floating widget so it can show the transcript
  // too. Fire-and-forget (ipcRenderer.send) — the widget subscribes via
  // recording.onTranscript. Ignored when the widget isn't open.
  ipcMain.on('desktop:recording:push-transcript', (_event, line) => {
    if (!line || !recordingState.isRecording) return;
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send('recording:transcript', line);
    }
  });

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
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      const [x, y] = widgetWindow.getPosition();
      savedWidgetPosition = { x, y };
      saveWidgetPrefs();
    }
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
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      const [x, y] = widgetWindow.getPosition();
      savedWidgetPosition = { x, y };
      saveWidgetPrefs();
    }
    return { ok: true };
  });

  ipcMain.handle('desktop:theme:broadcast', (_event, preference) => {
    emit('theme:changed', preference);
    return { ok: true };
  });

  ipcMain.handle('desktop:open-external', async (_event, url) => {
    try {
      console.log('[desktop] openExternal', String(url));
      await shell.openExternal(String(url));
      return { ok: true };
    } catch (error) {
      console.error('[desktop] openExternal failed', error);
      return { ok: false };
    }
  });

  ipcMain.handle('desktop:auth:consume-pending-callback', () => {
    const pending = pendingAuthCallback;
    pendingAuthCallback = null;
    return pending;
  });
}

app.setName(APP_NAME);

if (process.platform === 'win32') {
  app.setAppUserModelId('com.aimmeetingcopilot.desktop');
}

// Must register before app.ready — macOS can emit open-url during startup.
app.on('open-url', (event, url) => {
  event.preventDefault();
  console.log('[desktop][deeplink] open-url event', url);
  if (!isAuthDeepLink(url)) return;

  if (app.isReady() && mainWindow) {
    handleAuthDeepLink(url);
  } else {
    pendingAuthDeepLink = url;
  }
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  const launchDeepLink = findAuthDeepLinkInArgv(process.argv);
  if (launchDeepLink) {
    pendingAuthDeepLink = launchDeepLink;
  }
}

app.whenReady().then(() => {
  loadWidgetPrefs();
  configureMediaSessionPermissions();
  registerIpcHandlers();
  registerDeepLinking();
  createMainWindow();
  flushPendingAuthDeepLink();
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
