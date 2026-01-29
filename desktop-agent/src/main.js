const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, dialog, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');

console.log('=== DESKTOP AGENT MAIN PROCESS STARTING ===');
console.log('[MAIN] Node version:', process.version);
console.log('[MAIN] Electron version:', process.versions.electron);
console.log('[MAIN] Platform:', process.platform);
console.log('[MAIN] Working directory:', process.cwd());

const store = new Store();
// Use 127.0.0.1 instead of localhost to force IPv4 (avoids IPv6 ::1 connection issues)
const API_BASE = store.get('apiUrl') || 'http://127.0.0.1:5000';
console.log('[MAIN] Default API base:', API_BASE);

// Helper function to normalize URLs - converts localhost to 127.0.0.1 to force IPv4
function normalizeUrl(url) {
  if (!url) return url;
  // Replace localhost with 127.0.0.1 to avoid IPv6 connection issues
  return url.replace(/localhost/g, '127.0.0.1');
}

// Helper function to get API base URL with normalization
function getApiBase() {
  const storedUrl = store.get('apiUrl');
  const baseUrl = storedUrl || API_BASE;
  return normalizeUrl(baseUrl);
}

let mainWindow = null;
let tray = null;
let isMonitoring = false;
let captureInterval = null;
let activityTracker = null;
let idleCheckInterval = null;

let mouseClicks = 0;
let keystrokes = 0;
let lastActivityTime = Date.now();
let timerRunning = false;
let timerStartTime = null;
let currentTimerEntry = null;
let appTrackingInterval = null;
let lastActiveApp = null;

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

  // Open DevTools in development for debugging
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
    mainWindow.webContents.openDevTools();
    console.log('[MAIN] DevTools opened for debugging');
  }

  // Allow opening DevTools with keyboard shortcut (Ctrl+Shift+I or F12)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.toggleDevTools();
    }
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
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

  // Log when window is ready
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('[MAIN] Renderer window loaded');
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
    const privacy = store.get('privacy') || {};
    if (privacy.privacyMode) {
      console.log('Privacy mode enabled, skipping screenshot capture');
      return;
    }

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
    const response = await fetch(`${getApiBase()}/api/agent/screenshot`, {
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
    const response = await fetch(`${getApiBase()}/api/agent/heartbeat`, {
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
      if (data.privacy) {
        store.set('privacy', data.privacy);
        if (mainWindow) {
          mainWindow.webContents.send('privacy-settings', data.privacy);
        }
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

  startAppTracking();

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

  stopAppTracking();

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

async function startTimer(project = null, notes = null) {
  const token = store.get('authToken');
  if (!token) return { success: false, error: 'Not logged in' };

  try {
      const response = await fetch(`${getApiBase()}/api/agent/timer/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ project, notes })
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.activeEntry) {
        currentTimerEntry = error.activeEntry;
        timerRunning = true;
        timerStartTime = new Date(error.activeEntry.startTime);
        return { success: true, entry: error.activeEntry, alreadyRunning: true };
      }
      throw new Error(error.error || 'Failed to start timer');
    }

    const entry = await response.json();
    currentTimerEntry = entry;
    timerRunning = true;
    timerStartTime = new Date(entry.startTime);
    lastActivityTime = Date.now();

    startIdleDetection();
    updateTrayMenu();

    if (mainWindow) {
      mainWindow.webContents.send('timer-status', { running: true, entry });
    }

    return { success: true, entry };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function stopTimer() {
  const token = store.get('authToken');
  if (!token) return { success: false, error: 'Not logged in' };

  try {
    const response = await fetch(`${getApiBase()}/api/agent/timer/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to stop timer');
    }

    const entry = await response.json();
    timerRunning = false;
    timerStartTime = null;
    currentTimerEntry = null;

    stopIdleDetection();
    updateTrayMenu();

    if (mainWindow) {
      mainWindow.webContents.send('timer-status', { running: false, entry });
    }

    return { success: true, entry };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getTimerStatus() {
  const token = store.get('authToken');
  if (!token) return null;

  try {
    const response = await fetch(`${getApiBase()}/api/agent/timer/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const status = await response.json();
      timerRunning = status.isRunning;
      currentTimerEntry = status.activeEntry;
      timerStartTime = status.activeEntry ? new Date(status.activeEntry.startTime) : null;

      if (timerRunning) {
        startIdleDetection();
      }

      return status;
    }
  } catch (error) {
    console.error('Failed to get timer status:', error);
  }
  return null;
}

function startIdleDetection() {
  if (idleCheckInterval) return;

  const settings = store.get('settings') || { idleThreshold: 5 };
  const idleThresholdMs = (settings.idleThreshold || 5) * 60 * 1000;

  idleCheckInterval = setInterval(async () => {
    const now = Date.now();
    const idleTime = now - lastActivityTime;

    if (idleTime > idleThresholdMs && timerRunning) {
      const idleSeconds = Math.floor(idleTime / 1000);
      await reportIdleTime(idleSeconds);
    }
  }, 60000);
}

function stopIdleDetection() {
  if (idleCheckInterval) {
    clearInterval(idleCheckInterval);
    idleCheckInterval = null;
  }
}

async function reportIdleTime(idleSeconds) {
  const token = store.get('authToken');
  if (!token) return;

  try {
    await fetch(`${getApiBase()}/api/agent/timer/idle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ idleSeconds })
    });
  } catch (error) {
    console.error('Failed to report idle time:', error);
  }
}

function recordActivity() {
  lastActivityTime = Date.now();
}

async function getActiveWindowInfo() {
  try {
    const activeWindow = require('active-win');
    const result = await activeWindow();
    
    if (!result) return null;
    
    let appType = 'application';
    let url = null;
    const browserApps = ['chrome', 'firefox', 'safari', 'edge', 'brave', 'opera'];
    const appNameLower = (result.owner?.name || '').toLowerCase();
    
    if (browserApps.some(browser => appNameLower.includes(browser))) {
      appType = 'website';
      if (result.title) {
        const urlMatch = result.title.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          url = urlMatch[0];
        }
      }
    }
    
    return {
      appName: result.owner?.name || 'Unknown',
      windowTitle: result.title || '',
      appType,
      url,
    };
  } catch (error) {
    console.error('Failed to get active window:', error);
    return null;
  }
}

async function reportAppUsage(windowInfo) {
  const token = store.get('authToken');
  if (!token || !windowInfo) return;

  try {
    const response = await fetch(`${getApiBase()}/api/agent/app-usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(windowInfo)
    });

    if (!response.ok) {
      throw new Error(`App usage report failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.status === 'created' && mainWindow) {
      mainWindow.webContents.send('app-usage-changed', data.usage);
    }
  } catch (error) {
    console.error('Failed to report app usage:', error);
  }
}

async function trackActiveApp() {
  const privacy = store.get('privacy') || { trackApps: true, trackUrls: true };
  
  if (privacy.privacyMode) {
    console.log('Privacy mode enabled, skipping app tracking');
    return;
  }
  
  if (privacy.trackApps === false) {
    console.log('App tracking disabled, skipping');
    return;
  }

  const windowInfo = await getActiveWindowInfo();
  
  if (!windowInfo) return;
  
  if (!privacy.trackUrls && windowInfo.appType === 'website') {
    console.log('URL tracking disabled, skipping website tracking');
    return;
  }
  
  const appKey = `${windowInfo.appName}|${windowInfo.windowTitle}`;
  if (appKey !== lastActiveApp) {
    lastActiveApp = appKey;
    await reportAppUsage(windowInfo);
  }
}

function startAppTracking() {
  if (appTrackingInterval) return;
  
  trackActiveApp();
  
  appTrackingInterval = setInterval(trackActiveApp, 10000);
}

function stopAppTracking() {
  if (appTrackingInterval) {
    clearInterval(appTrackingInterval);
    appTrackingInterval = null;
  }
  lastActiveApp = null;
}

ipcMain.handle('login', async (event, { serverUrl, teamMemberId, deviceName, platform }) => {
  console.log('=== DESKTOP AGENT LOGIN START ===');
  console.log('[LOGIN] Received login request with:', {
    serverUrl,
    teamMemberId,
    deviceName,
    platform
  });

  try {
    // Normalize localhost to 127.0.0.1 to force IPv4 (avoids IPv6 ::1 connection issues)
    const normalizedUrl = normalizeUrl(serverUrl);
    if (normalizedUrl !== serverUrl) {
      console.log('[LOGIN] Normalized URL from localhost to 127.0.0.1:', normalizedUrl);
    }
    
    store.set('apiUrl', normalizedUrl);
    
    const requestUrl = `${normalizedUrl}/api/agent/register`;
    const requestBody = { teamMemberId, deviceName, platform };
    
    console.log('[LOGIN] Making fetch request to:', requestUrl);
    console.log('[LOGIN] Request body:', JSON.stringify(requestBody, null, 2));
    console.log('[LOGIN] Request headers:', { 'Content-Type': 'application/json' });

    let response;
    try {
      response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      console.log('[LOGIN] Fetch completed. Response status:', response.status);
      console.log('[LOGIN] Response status text:', response.statusText);
      console.log('[LOGIN] Response headers:', Object.fromEntries(response.headers.entries()));
    } catch (fetchError) {
      console.error('[LOGIN] Fetch error occurred:', fetchError);
      console.error('[LOGIN] Fetch error name:', fetchError.name);
      console.error('[LOGIN] Fetch error message:', fetchError.message);
      console.error('[LOGIN] Fetch error stack:', fetchError.stack);
      throw new Error(`Network error: ${fetchError.message}`);
    }

    if (!response.ok) {
      console.error('[LOGIN] Response not OK. Status:', response.status);
      let errorData;
      try {
        const text = await response.text();
        console.error('[LOGIN] Error response body (text):', text);
        errorData = JSON.parse(text);
        console.error('[LOGIN] Error response body (parsed):', errorData);
      } catch (parseError) {
        console.error('[LOGIN] Failed to parse error response:', parseError);
        throw new Error(`Registration failed with status ${response.status}`);
      }
      throw new Error(errorData.error || 'Registration failed');
    }

    const data = await response.json();
    console.log('[LOGIN] Success! Response data:', {
      hasToken: !!data.token,
      hasAgentId: !!data.agentId,
      teamMemberName: data.teamMember?.name,
      teamMemberId: data.teamMember?.id
    });
    
    store.set('authToken', data.token);
    store.set('agentId', data.agentId);
    store.set('userName', data.teamMember.name);
    store.set('teamMemberId', data.teamMember.id);

    updateTrayMenu();
    
    console.log('[LOGIN] Login successful for:', data.teamMember.name);
    console.log('=== DESKTOP AGENT LOGIN SUCCESS ===');
    return { success: true, userName: data.teamMember.name };
  } catch (error) {
    console.error('[LOGIN] Login failed with error:', error);
    console.error('[LOGIN] Error type:', error.constructor.name);
    console.error('[LOGIN] Error message:', error.message);
    console.error('[LOGIN] Error stack:', error.stack);
    console.log('=== DESKTOP AGENT LOGIN FAILED ===');
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
    const response = await fetch(`${getApiBase()}/api/agent/settings`, {
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

ipcMain.handle('start-timer', async (event, { project, notes }) => {
  return await startTimer(project, notes);
});

ipcMain.handle('stop-timer', async () => {
  return await stopTimer();
});

ipcMain.handle('get-timer-status', async () => {
  return await getTimerStatus();
});

ipcMain.handle('record-activity', () => {
  recordActivity();
  mouseClicks++;
  return { success: true };
});

ipcMain.handle('get-status', () => {
  return {
    isLoggedIn: !!store.get('authToken'),
    isMonitoring,
    isTimerRunning: timerRunning,
    timerStartTime,
    currentTimerEntry,
    userName: store.get('userName'),
    settings: store.get('settings')
  };
});

app.whenReady().then(() => {
  console.log('=== DESKTOP AGENT STARTING ===');
  console.log('[MAIN] App ready, creating window and tray...');
  createWindow();
  createTray();

  const token = store.get('authToken');
  const autoStart = store.get('settings')?.autoStartMonitoring;
  
  console.log('[MAIN] Initial state:', {
    hasToken: !!token,
    autoStart: autoStart !== false
  });
  
  if (token && autoStart !== false) {
    console.log('[MAIN] Auto-starting monitoring in 2 seconds...');
    setTimeout(startMonitoring, 2000);
  }
  
  console.log('[MAIN] Desktop agent initialized');
  console.log('[MAIN] Press Ctrl+Shift+I (or Cmd+Option+I on Mac) to open DevTools');
  console.log('=== DESKTOP AGENT READY ===');
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
