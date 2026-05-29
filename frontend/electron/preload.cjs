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
  auth: {
    openExternal: (url) => ipcRenderer.invoke('desktop:open-external', url),
    onCallback: (callback) => registerListener('auth:callback', callback)
  },
  permissions: {
    getAll: () => ipcRenderer.invoke('desktop:permissions:get-all'),
    requestMicrophone: () => ipcRenderer.invoke('desktop:permissions:request-microphone'),
    requestNotifications: () => ipcRenderer.invoke('desktop:permissions:request-notifications'),
    openSettings: (target) => ipcRenderer.invoke('desktop:permissions:open-settings', target)
  },
  deviceCheck: {
    listCaptureSources: () => ipcRenderer.invoke('desktop:device-check:list-capture-sources'),
  },
  recording: {
    start: () => ipcRenderer.invoke('desktop:recording:start'),
    pauseResume: () => ipcRenderer.invoke('desktop:recording:pause-resume'),
    stop: () => ipcRenderer.invoke('desktop:recording:stop'),
    getStatus: () => ipcRenderer.invoke('desktop:recording:status'),
    onStateChange: (callback) => registerListener('recording:state', callback),
    onTranscript: (callback) => registerListener('recording:transcript', callback)
  },
  theme: {
    broadcast: (preference) => ipcRenderer.invoke('desktop:theme:broadcast', preference),
    onChange: (callback) => registerListener('theme:changed', callback)
  },
  widget: {
    setExpanded: (expanded) => ipcRenderer.invoke('desktop:widget:set-expanded', expanded),
    openMain: () => ipcRenderer.invoke('desktop:widget:open-main'),
    dragStart: () => ipcRenderer.invoke('desktop:widget:drag-start'),
    dragMove: () => ipcRenderer.invoke('desktop:widget:drag-move'),
    dragEnd: () => ipcRenderer.invoke('desktop:widget:drag-end'),
    resizeStart: (edge) => ipcRenderer.invoke('desktop:widget:resize-start', edge),
    resizeMove: () => ipcRenderer.invoke('desktop:widget:resize-move'),
    resizeEnd: () => ipcRenderer.invoke('desktop:widget:resize-end')
  }
});
