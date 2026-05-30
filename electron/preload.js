const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Add any needed IPC methods here
  onOpenProjection: (callback) => ipcRenderer.on('open-projection', callback),
  sendToMain: (channel, data) => ipcRenderer.send(channel, data),
});
