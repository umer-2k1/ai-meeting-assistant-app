const path = require('node:path');
const { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain } = require('electron');

const isTestMode = process.env.ELECTRON_TEST_MODE === '1';

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;

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

function formatTimestamp(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `00:${mm}:${ss}`;
}

function emit(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function emitRecordingState() {
  emit('recording:state', { ...recordingState });
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
  emitRecordingState();
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
  emitRecordingState();
  return { ...recordingState };
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: '#050A1A',
    title: 'AI Meeting Copilot',
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'public', 'favicon.ico');
  tray = new Tray(iconPath);
  tray.setToolTip('AI Meeting Copilot');

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

  ipcMain.handle('desktop:recording:start', () => startRecording());
  ipcMain.handle('desktop:recording:pause-resume', () => pauseResumeRecording());
  ipcMain.handle('desktop:recording:stop', () => stopRecording());
  ipcMain.handle('desktop:recording:status', () => ({ ...recordingState }));
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();
  if (!isTestMode) {
    createTray();
  }
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
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
