const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  logout: () => ipcRenderer.invoke('logout'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  startMonitoring: () => ipcRenderer.invoke('start-monitoring'),
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  
  startTimer: (options) => ipcRenderer.invoke('start-timer', options || {}),
  stopTimer: () => ipcRenderer.invoke('stop-timer'),
  getTimerStatus: () => ipcRenderer.invoke('get-timer-status'),
  recordActivity: () => ipcRenderer.invoke('record-activity'),
  
  onMonitoringStatus: (callback) => {
    ipcRenderer.on('monitoring-status', (event, status) => callback(status));
  },
  onNavigate: (callback) => {
    ipcRenderer.on('navigate', (event, page) => callback(page));
  },
  onTimerStatus: (callback) => {
    ipcRenderer.on('timer-status', (event, status) => callback(status));
  }
});
