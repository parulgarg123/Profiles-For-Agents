const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getProfiles: (dir) => ipcRenderer.invoke('git:getProfiles', dir),
  getProfilePreview: (dir, name) => ipcRenderer.invoke('git:getProfilePreview', dir, name),
  initRepo: (dir) => ipcRenderer.invoke('git:initRepo', dir),
  createProfile: (dir, name, blank) => ipcRenderer.invoke('git:createProfile', dir, name, blank),
  switchProfile: (dir, name) => ipcRenderer.invoke('git:switchProfile', dir, name),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  getHomeDir: () => ipcRenderer.invoke('system:getHomeDir'),
});
