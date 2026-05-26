const { contextBridge, ipcRenderer } = require('electron');

function registerListener(channel, callback) {
  const handler = (_event, payload) => {
    callback(payload);
  };

  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

contextBridge.exposeInMainWorld('desktop', {
  app: {
    getInfo: () => ipcRenderer.invoke('desktop:app-info')
  },
  recording: {
    start: () => ipcRenderer.invoke('desktop:recording:start'),
    pauseResume: () => ipcRenderer.invoke('desktop:recording:pause-resume'),
    stop: () => ipcRenderer.invoke('desktop:recording:stop'),
    getStatus: () => ipcRenderer.invoke('desktop:recording:status'),
    onStateChange: (callback) => registerListener('recording:state', callback),
    onTranscript: (callback) => registerListener('recording:transcript', callback)
  }
});
