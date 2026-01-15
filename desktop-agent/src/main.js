const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, dialog, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();
const API_BASE = store.get('apiUrl') || 'http://localhost:5000';

let mainWindow = null;
let tray = null;
let isMonitoring = false;
let captureInterval = null;
let activityTracker = null;

let mouseClicks = 0;
let keystrokes = 0;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    resizable: false,
    frame: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.once('ready-to-show', () => {
    const token = store.get('authToken');
    if (!token) {
      mainWindow.show();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty();
    }
  } catch (e) {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('TeamTrack Agent');
  
  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

function updateTrayMenu() {
  const isLoggedIn = !!store.get('authToken');
  const userName = store.get('userName') || 'Not logged in';

  const contextMenu = Menu.buildFromTemplate([
    { label: `TeamTrack Agent`, enabled: false },
    { type: 'separator' },
    { label: userName, enabled: false },
    { type: 'separator' },
    {
      label: isMonitoring ? 'Stop Monitoring' : 'Start Monitoring',
      enabled: isLoggedIn,
      click: () => toggleMonitoring()
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('navigate', 'settings');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

async function captureScreenshot() {
  try {
    const screenshot = require('screenshot-desktop');
    const displays = await screenshot.listDisplays();
    const primaryDisplay = displays[0];
    
    const imgBuffer = await screenshot({ screen: primaryDisplay.id, format: 'png' });
    const base64Image = `data:image/png;base64,${imgBuffer.toString('base64')}`;

    const activityScore = calculateActivityScore();
    
    await uploadScreenshot(base64Image, activityScore);

    mouseClicks = 0;
    keystrokes = 0;
  } catch (error) {
    console.error('Screenshot capture failed:', error);
  }
}

function calculateActivityScore() {
  const maxClicks = 100;
  const maxKeystrokes = 500;
  
  const clickScore = Math.min(mouseClicks / maxClicks, 1) * 50;
  const keystrokeScore = Math.min(keystrokes / maxKeystrokes, 1) * 50;
  
  return Math.round(clickScore + keystrokeScore);
}

async function uploadScreenshot(imageData, activityScore) {
  const token = store.get('authToken');
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/api/agent/screenshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        imageData,
        mouseClicks,
        keystrokes,
        activityScore
      })
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    console.log('Screenshot uploaded successfully');
  } catch (error) {
    console.error('Failed to upload screenshot:', error);
  }
}

async function sendHeartbeat() {
  const token = store.get('authToken');
  if (!token) return;

  try {
    const status = isMonitoring ? 'online' : 'idle';
    const response = await fetch(`${API_BASE}/api/agent/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status, mouseClicks, keystrokes })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.settings) {
        store.set('settings', data.settings);
      }
    }
  } catch (error) {
    console.error('Heartbeat failed:', error);
  }
}

function startMonitoring() {
  if (isMonitoring) return;
  
  isMonitoring = true;
  const settings = store.get('settings') || { screenshotInterval: 5 };
  const intervalMs = settings.screenshotInterval * 60 * 1000;

  captureScreenshot();
  
  captureInterval = setInterval(captureScreenshot, intervalMs);

  setInterval(sendHeartbeat, 30000);

  updateTrayMenu();
  
  if (mainWindow) {
    mainWindow.webContents.send('monitoring-status', true);
  }
}

function stopMonitoring() {
  if (!isMonitoring) return;
  
  isMonitoring = false;
  
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }

  updateTrayMenu();
  
  if (mainWindow) {
    mainWindow.webContents.send('monitoring-status', false);
  }

  sendHeartbeat();
}

function toggleMonitoring() {
  if (isMonitoring) {
    stopMonitoring();
  } else {
    startMonitoring();
  }
}

ipcMain.handle('login', async (event, { serverUrl, teamMemberId, deviceName, platform }) => {
  try {
    store.set('apiUrl', serverUrl);
    
    const response = await fetch(`${serverUrl}/api/agent/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamMemberId, deviceName, platform })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    const data = await response.json();
    
    store.set('authToken', data.token);
    store.set('agentId', data.agentId);
    store.set('userName', data.teamMember.name);
    store.set('teamMemberId', data.teamMember.id);

    updateTrayMenu();
    
    return { success: true, userName: data.teamMember.name };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('logout', async () => {
  stopMonitoring();
  store.delete('authToken');
  store.delete('agentId');
  store.delete('userName');
  store.delete('teamMemberId');
  updateTrayMenu();
  return { success: true };
});

ipcMain.handle('get-status', () => {
  return {
    isLoggedIn: !!store.get('authToken'),
    isMonitoring,
    userName: store.get('userName'),
    settings: store.get('settings')
  };
});

ipcMain.handle('start-monitoring', () => {
  startMonitoring();
  return { success: true };
});

ipcMain.handle('stop-monitoring', () => {
  stopMonitoring();
  return { success: true };
});

ipcMain.handle('get-settings', async () => {
  const token = store.get('authToken');
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE}/api/agent/settings`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const settings = await response.json();
      store.set('settings', settings);
      return settings;
    }
  } catch (error) {
    console.error('Failed to fetch settings:', error);
  }
  
  return store.get('settings');
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  const token = store.get('authToken');
  const autoStart = store.get('settings')?.autoStartMonitoring;
  
  if (token && autoStart !== false) {
    setTimeout(startMonitoring, 2000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
