const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  logout: () => ipcRenderer.invoke('logout'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  startMonitoring: () => ipcRenderer.invoke('start-monitoring'),
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  
  onMonitoringStatus: (callback) => {
    ipcRenderer.on('monitoring-status', (event, status) => callback(status));
  },
  onNavigate: (callback) => {
    ipcRenderer.on('navigate', (event, page) => callback(page));
  }
});
