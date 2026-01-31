// FIXED DESKTOP AGENT MAIN.JS
// Critical fixes:
// 1. Proper base64 encoding without data URL prefix for file saving
// 2. Send data URL prefix to server for validation
// 3. Fixed window visibility on startup
// 4. Better error handling

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, powerMonitor } = require("electron");
const fetch = global.fetch || require("node-fetch");
const path = require("path");
const Store = require("electron-store");

// ============================================================================
// INITIALIZATION & CONFIGURATION
// ============================================================================

console.log("=== DESKTOP AGENT MAIN PROCESS STARTING ===");
console.log("[MAIN] Node version:", process.version);
console.log("[MAIN] Electron version:", process.versions.electron);
console.log("[MAIN] Platform:", process.platform);

const store = new Store();

// ============================================================================
// API CONFIGURATION
// ============================================================================

function normalizeUrl(url) {
  if (!url) return url;
  return url.replace(/localhost/g, "127.0.0.1");
}

function getApiBase() {
  const storedUrl = store.get("apiUrl");
  const baseUrl = storedUrl || "http://127.0.0.1:5000";
  return normalizeUrl(baseUrl);
}

console.log("[MAIN] Default API base:", getApiBase());

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let mainWindow = null;
let tray = null;
let isMonitoring = false;
let captureInterval = null;
let idleCheckInterval = null;
let appTrackingInterval = null;
let heartbeatInterval = null;

let mouseClicks = 0;
let keystrokes = 0;
let lastActivityTime = Date.now();
let lastActiveApp = null;

let timerRunning = false;
let timerStartTime = null;
let currentTimerEntry = null;

let isServerReachable = false;

// ============================================================================
// SERVER CONNECTION VALIDATION
// ============================================================================

async function checkServerConnection() {
  try {
    const response = await fetch(`${getApiBase()}/api/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${store.get("authToken") || store.get("agentToken")}`,
      },
    });

    isServerReachable = response.ok || response.status === 401;
    console.log("[CONNECTION] Server reachable:", isServerReachable);
    return isServerReachable;
  } catch (error) {
    console.error("[CONNECTION] Server not reachable:", error.message);
    isServerReachable = false;
    return false;
  }
}

// ============================================================================
// WINDOW MANAGEMENT
// ============================================================================

function createWindow() {
  console.log("[MAIN] Creating window...");

  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    resizable: false,
    frame: true,
    show: false, // Start hidden, show after ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Development tools
  if (process.env.NODE_ENV === "development" || process.env.DEBUG === "true") {
    mainWindow.webContents.openDevTools();
  }

  // Keyboard shortcuts
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === "i") {
      mainWindow.webContents.toggleDevTools();
    }
    if (input.key === "F12") {
      mainWindow.webContents.toggleDevTools();
    }
  });

  const indexPath = path.join(__dirname, "renderer", "index.html");
  console.log("[MAIN] Loading renderer from:", indexPath);

  mainWindow.loadFile(indexPath);

  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // FIXED: Always show window after it's ready
  mainWindow.once("ready-to-show", () => {
    console.log("[MAIN] Window ready to show");
    const token = store.get("authToken");

    // Always show window on first launch or if not logged in
    if (!token) {
      console.log("[MAIN] No token, showing login window");
      mainWindow.show();
    } else {
      console.log("[MAIN] Token exists, showing window anyway");
      mainWindow.show(); // CHANGED: Always show the window
    }
  });

  mainWindow.webContents.once("did-finish-load", () => {
    console.log("[MAIN] Renderer window loaded successfully");
  });
}

// ============================================================================
// TRAY MANAGEMENT
// ============================================================================

function createTray() {
  const iconPath = path.join(__dirname, "..", "assets", "tray-icon.png");

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
  tray.setToolTip("TeamTrack Agent");

  updateTrayMenu();

  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

function updateTrayMenu() {
  const isLoggedIn = !!store.get("authToken");
  const userName = store.get("userName") || "Not logged in";

  const contextMenu = Menu.buildFromTemplate([
    { label: `TeamTrack Agent`, enabled: false },
    { type: "separator" },
    { label: userName, enabled: false },
    { type: "separator" },
    {
      label: isMonitoring ? "Stop Monitoring" : "Start Monitoring",
      enabled: isLoggedIn,
      click: () => toggleMonitoring(),
    },
    { type: "separator" },
    {
      label: "Settings",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send("navigate", "settings");
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// ============================================================================
// API UTILITIES
// ============================================================================

async function apiFetch(path, opts = {}) {
  const url = `${getApiBase()}${path}`;

  const isAgentPath = path.startsWith("/api/agent");
  const agentToken = store.get("agentToken");
  const authToken = store.get("authToken");

  const token = isAgentPath ? agentToken || authToken : authToken || agentToken;

  console.log(`[API] ${opts.method || "GET"} ${path}`);

  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, { ...opts, headers });

    console.log(`[API] Response status: ${res.status}`);

    if (!res.ok) {
      const text = await res.text().catch(() => "<no body>");
      let body = text;
      try {
        body = JSON.parse(text);
      } catch (_) {}

      console.error(`[API] Error ${res.status}:`, body);

      if (res.status === 401) {
        console.error("[API] Token expired or invalid");
        store.delete("authToken");
        store.delete("agentToken");
        mainWindow?.webContents?.send("auth:expired");
      }

      throw new Error(`${res.status} ${typeof body === "string" ? body : JSON.stringify(body)}`);
    }

    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
  } catch (error) {
    console.error("[API] Request failed:", error);
    throw error;
  }
}

// ============================================================================
// SCREENSHOT CAPTURE - FIXED VERSION
// ============================================================================

async function captureScreenshot() {
  try {
    const privacy = store.get("privacy") || {};
    if (privacy.privacyMode) {
      console.log("[SCREENSHOT] Privacy mode enabled, skipping");
      return;
    }

    console.log("[SCREENSHOT] Capturing screenshot...");
    const screenshot = require("screenshot-desktop");

    const displays = await screenshot.listDisplays();
    if (!displays || displays.length === 0) {
      console.error("[SCREENSHOT] No displays found");
      return;
    }

    const primaryDisplay = displays[0];
    console.log("[SCREENSHOT] Using display:", primaryDisplay.id);

    // ✅ THIS WAS MISSING
    const result = await screenshot({
      screen: primaryDisplay.id,
      format: "png",
    });

    // result can be Buffer OR { image, width, height }
    const imgBuffer = Buffer.isBuffer(result) ? result : result?.image;

    if (!imgBuffer || !Buffer.isBuffer(imgBuffer)) {
      throw new Error("Invalid screenshot buffer");
    }

    console.log("[SCREENSHOT] Screenshot captured, size:", imgBuffer.length, "bytes");

    const base64Data = imgBuffer.toString("base64");
    const dataUrl = `data:image/png;base64,${base64Data}`;

    const activityScore = calculateActivityScore();

    await uploadScreenshot(dataUrl, activityScore);

    // Reset activity counters
    mouseClicks = 0;
    keystrokes = 0;
  } catch (error) {
    console.error("[SCREENSHOT] Capture failed:", error);
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
  try {
    console.log("[SCREENSHOT] Uploading screenshot...");
    console.log("[SCREENSHOT] Activity score:", activityScore);
    console.log("[SCREENSHOT] Mouse clicks:", mouseClicks);
    console.log("[SCREENSHOT] Keystrokes:", keystrokes);
    console.log("[SCREENSHOT] Image data length:", imageData.length);

    const payload = {
      imageData,
      mouseClicks,
      keystrokes,
      activityScore,
    };

    const data = await apiFetch("/api/agent/screenshot", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    console.log("[SCREENSHOT] Uploaded successfully:", data);
  } catch (error) {
    console.error("[SCREENSHOT] Upload failed:", error);

    if (error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed")) {
      isServerReachable = false;
      console.log("[SCREENSHOT] Server appears to be down");
    }
  }
}

// ============================================================================
// HEARTBEAT
// ============================================================================

async function sendHeartbeat() {
  try {
    const status = isMonitoring ? "online" : "idle";

    console.log("[HEARTBEAT] Sending heartbeat, status:", status);

    const data = await apiFetch("/api/agent/heartbeat", {
      method: "POST",
      body: JSON.stringify({
        status,
        mouseClicks,
        keystrokes,
      }),
    });

    console.log("[HEARTBEAT] Sent successfully");
    isServerReachable = true;

    if (data.settings) {
      store.set("settings", data.settings);
    }

    if (data.privacy) {
      store.set("privacy", data.privacy);
      if (mainWindow) {
        mainWindow.webContents.send("privacy-settings", data.privacy);
      }
    }
  } catch (error) {
    console.error("[HEARTBEAT] Failed:", error);

    if (error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed")) {
      isServerReachable = false;
      console.log("[HEARTBEAT] Server appears to be down");
    }
  }
}

// ============================================================================
// MONITORING CONTROL
// ============================================================================

async function startMonitoring() {
  if (isMonitoring) {
    console.log("[MONITORING] Already started");
    return;
  }

  const serverOk = await checkServerConnection();
  if (!serverOk) {
    console.error("[MONITORING] Cannot start - server not reachable");
    if (mainWindow) {
      mainWindow.webContents.send("error", "Cannot start monitoring - server not reachable");
    }
    return;
  }

  console.log("[MONITORING] Starting...");
  isMonitoring = true;

  const settings = store.get("settings") || { screenshotInterval: 5 };
  const intervalMinutes = settings.screenshotInterval || 5;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log("[MONITORING] Screenshot interval:", intervalMinutes, "minutes");

  // Initial screenshot after 5 seconds
  setTimeout(() => {
    if (isServerReachable) {
      captureScreenshot();
    }
  }, 5000);

  // Periodic screenshots
  if (captureInterval) {
    clearInterval(captureInterval);
  }
  captureInterval = setInterval(() => {
    if (isServerReachable) {
      console.log("[MONITORING] Triggering scheduled screenshot");
      captureScreenshot();
    } else {
      console.log("[MONITORING] Skipping screenshot - server not reachable");
    }
  }, intervalMs);

  // Heartbeat every 30 seconds
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  heartbeatInterval = setInterval(() => {
    sendHeartbeat();
  }, 30000);

  sendHeartbeat();
  startAppTracking();
  updateTrayMenu();

  if (mainWindow) {
    mainWindow.webContents.send("monitoring-status", true);
  }

  console.log("[MONITORING] Started successfully");
}

function stopMonitoring() {
  if (!isMonitoring) {
    console.log("[MONITORING] Already stopped");
    return;
  }

  console.log("[MONITORING] Stopping...");
  isMonitoring = false;

  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  stopAppTracking();
  updateTrayMenu();

  if (mainWindow) {
    mainWindow.webContents.send("monitoring-status", false);
  }

  sendHeartbeat();
  console.log("[MONITORING] Stopped successfully");
}

function toggleMonitoring() {
  if (isMonitoring) {
    stopMonitoring();
  } else {
    startMonitoring();
  }
}

// ============================================================================
// TIMER MANAGEMENT
// ============================================================================

let timerInterval = null; // add at the top of your file with other globals

async function startTimer(project = null, notes = null) {
  if (!isMonitoring) {
    console.warn("[TIMER] Cannot start timer — monitoring is OFF");
    return {
      success: false,
      error: "Monitoring must be active to start the timer",
    };
  }

  console.log("[TIMER] Starting timer...", { project, notes });

  try {
    const payload = {};
    if (project) payload.project = project;
    if (notes) payload.notes = notes;

    const data = await apiFetch("/api/agent/timer/start", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    currentTimerEntry = data;
    timerRunning = true;
    timerStartTime = new Date(data.startTime);
    lastActivityTime = Date.now();

    startIdleDetection();
    updateTrayMenu();

    // ===== NEW: start live UI timer =====
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (mainWindow && timerRunning && timerStartTime) {
        const elapsedMs = Date.now() - timerStartTime.getTime();
        const hours = String(Math.floor(elapsedMs / 3600000)).padStart(2, "0");
        const minutes = String(Math.floor((elapsedMs % 3600000) / 60000)).padStart(2, "0");
        const seconds = String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, "0");

        mainWindow.webContents.send("timer-tick", {
          elapsed: `${hours}:${minutes}:${seconds}`,
        });
      }
    }, 1000);

    // ===== END NEW =====

    if (mainWindow) {
      mainWindow.webContents.send("timer-status", {
        running: true,
        entry: data,
      });
    }

    return { success: true, entry: data };
  } catch (error) {
    console.error("[TIMER] Start failed:", error);
    return { success: false, error: error.message };
  }
}

async function stopTimer() {
  console.log("[TIMER] Stopping timer...");

  try {
    const data = await apiFetch("/api/agent/timer/stop", {
      method: "POST",
    });

    timerRunning = false;
    timerStartTime = null;
    currentTimerEntry = null;

    stopIdleDetection();
    updateTrayMenu();

    // ===== NEW: stop live UI timer =====
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // ===== END NEW =====

    if (mainWindow) {
      mainWindow.webContents.send("timer-status", {
        running: false,
        entry: data,
      });
    }

    return { success: true, entry: data };
  } catch (error) {
    console.error("[TIMER] Stop failed:", error);
    return { success: false, error: error.message };
  }
}

async function getTimerStatus() {
  try {
    const status = await apiFetch("/api/agent/timer/status", {
      method: "GET",
    });

    timerRunning = status.isRunning;
    currentTimerEntry = status.activeEntry;
    timerStartTime = status.activeEntry ? new Date(status.activeEntry.startTime) : null;

    if (timerRunning) {
      startIdleDetection();
    }

    return status;
  } catch (error) {
    console.error("[TIMER] Failed to get status:", error);
    return null;
  }
}

// ============================================================================
// IDLE DETECTION
// ============================================================================

function startIdleDetection() {
  if (idleCheckInterval) {
    return;
  }

  console.log("[IDLE] Starting detection...");

  const settings = store.get("settings") || { idleThreshold: 5 };
  const idleThresholdMs = (settings.idleThreshold || 5) * 60 * 1000;

  idleCheckInterval = setInterval(async () => {
    const now = Date.now();
    const idleTime = now - lastActivityTime;

    if (idleTime > idleThresholdMs && timerRunning) {
      const idleSeconds = Math.floor(idleTime / 1000);
      console.log(`[IDLE] Detected ${idleSeconds}s of idle time`);
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
  try {
    await apiFetch("/api/agent/timer/idle", {
      method: "POST",
      body: JSON.stringify({ idleSeconds }),
    });
    console.log(`[IDLE] Reported ${idleSeconds}s`);
  } catch (error) {
    console.error("[IDLE] Failed to report:", error);
  }
}

function recordActivity() {
  lastActivityTime = Date.now();
}

// ============================================================================
// APP TRACKING
// ============================================================================

async function getActiveWindowInfo() {
  try {
    const activeWindow = require("active-win");
    const result = await activeWindow();

    if (!result) return null;

    let appType = "application";
    let url = undefined;
    const browserApps = ["chrome", "firefox", "safari", "edge", "brave", "opera"];
    const appNameLower = (result.owner?.name || "").toLowerCase();

    if (browserApps.some((browser) => appNameLower.includes(browser))) {
      appType = "website";
      if (result.title) {
        const urlMatch = result.title.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          url = urlMatch[0];
        }
      }
    }

    const payload = {
      appName: result.owner?.name || "Unknown",
      windowTitle: result.title || "",
      appType,
    };

    if (url) {
      payload.url = url;
    }

    return payload;
  } catch (error) {
    console.error("[APP_TRACKING] Failed to get active window:", error);
    return null;
  }
}

async function reportAppUsage(windowInfo) {
  if (!windowInfo) return;

  try {
    const data = await apiFetch("/api/agent/app-usage", {
      method: "POST",
      body: JSON.stringify(windowInfo),
    });

    if (data.status === "created" && mainWindow) {
      mainWindow.webContents.send("app-usage-changed", data.usage);
    }
  } catch (error) {
    console.error("[APP_TRACKING] Failed to report:", error);
  }
}

async function trackActiveApp() {
  const privacy = store.get("privacy") || {
    trackApps: true,
    trackUrls: true,
  };

  if (privacy.privacyMode) {
    return;
  }

  if (privacy.trackApps === false) {
    return;
  }

  const windowInfo = await getActiveWindowInfo();

  if (!windowInfo) return;

  if (!privacy.trackUrls && windowInfo.appType === "website") {
    return;
  }

  const appKey = `${windowInfo.appName}|${windowInfo.windowTitle}`;
  if (appKey !== lastActiveApp) {
    lastActiveApp = appKey;
    await reportAppUsage(windowInfo);
  }
}

function startAppTracking() {
  if (appTrackingInterval) {
    return;
  }

  console.log("[APP_TRACKING] Starting...");
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

// ============================================================================
// IPC HANDLERS
// ============================================================================

ipcMain.handle("login", async (event, { serverUrl, teamMemberId, deviceName, platform }) => {
  console.log("=== LOGIN REQUEST START ===");

  try {
    const normalizedUrl = normalizeUrl(serverUrl);
    store.set("apiUrl", normalizedUrl);

    const response = await fetch(`${normalizedUrl}/api/agent/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamMemberId, deviceName, platform }),
    });

    console.log("[LOGIN] Response status:", response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error("[LOGIN] Error response:", text);

      let errorData;
      try {
        errorData = JSON.parse(text);
      } catch (e) {
        throw new Error(`Registration failed with status ${response.status}: ${text}`);
      }

      throw new Error(errorData.error || "Registration failed");
    }

    const data = await response.json();

    store.set("agentToken", data.token);
    store.set("authToken", data.token);
    store.set("agentId", data.agentId);
    store.set("userName", data.teamMember.name);
    store.set("teamMemberId", data.teamMember.id);

    updateTrayMenu();

    console.log("[LOGIN] Login successful for:", data.teamMember.name);
    console.log("=== LOGIN REQUEST SUCCESS ===");

    return {
      success: true,
      userName: data.teamMember.name,
    };
  } catch (error) {
    console.error("[LOGIN] Failed:", error);
    console.log("=== LOGIN REQUEST FAILED ===");

    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle("logout", async () => {
  console.log("[LOGOUT] Logging out...");

  stopMonitoring();

  store.delete("authToken");
  store.delete("agentToken");
  store.delete("agentId");
  store.delete("userName");
  store.delete("teamMemberId");

  updateTrayMenu();

  console.log("[LOGOUT] Logged out successfully");
  return { success: true };
});

ipcMain.handle("start-monitoring", () => {
  startMonitoring();
  return { success: true };
});

ipcMain.handle("stop-monitoring", () => {
  stopMonitoring();
  return { success: true };
});

ipcMain.handle("get-settings", async () => {
  try {
    const data = await apiFetch("/api/agent/settings", {
      method: "GET",
    });

    store.set("settings", data);
    return data;
  } catch (error) {
    console.error("[SETTINGS] Failed to fetch:", error);
    return store.get("settings");
  }
});

ipcMain.handle("start-timer", async (event, { project, notes }) => {
  return await startTimer(project, notes);
});

ipcMain.handle("stop-timer", async () => {
  return await stopTimer();
});

ipcMain.handle("get-timer-status", async () => {
  return await getTimerStatus();
});

ipcMain.handle("record-activity", () => {
  recordActivity();
  mouseClicks++;
  return { success: true };
});

ipcMain.handle("get-status", () => {
  const authToken = store.get("authToken");
  const agentToken = store.get("agentToken");

  return {
    isLoggedIn: !!(authToken || agentToken),
    isMonitoring,
    isTimerRunning: timerRunning,
    timerStartTime,
    currentTimerEntry,
    userName: store.get("userName"),
    settings: store.get("settings"),
  };
});

// ============================================================================
// APP LIFECYCLE
// ============================================================================

app.whenReady().then(async () => {
  console.log("=== DESKTOP AGENT STARTING ===");

  // -----------------------------
  // SYSTEM SUSPEND / RESUME
  // -----------------------------
  powerMonitor.on("suspend", async () => {
    console.log("[POWER] System sleeping — pausing timer & monitoring");

    if (timerRunning) {
      await stopTimer();
      store.set("timerWasRunning", true); // remember to resume later
    }

    if (isMonitoring) stopMonitoring();

    // 🔥 HARD UI RESET
    mainWindow?.webContents.send("monitoring-status", false);
    mainWindow?.webContents.send("timer-status", { running: false, entry: null });
  });

  powerMonitor.on("resume", async () => {
    console.log("[POWER] System resumed");

    const wasRunning = store.get("timerWasRunning");
    if (wasRunning && isMonitoring) {
      store.delete("timerWasRunning");
      const project = currentTimerEntry?.project || null;
      const notes = currentTimerEntry?.notes || null;
      await startTimer(project, notes);
    }

    refreshTodayStats(); // Always update the "time tracked today"
  });

  // -----------------------------
  // SESSION LOCK / UNLOCK (Win+L)
  // -----------------------------
  powerMonitor.on("lock-screen", async () => {
    console.log("[POWER] Screen locked — pausing timer & monitoring");

    if (timerRunning) {
      await stopTimer();
      store.set("timerWasRunning", true);
    }

    if (isMonitoring) stopMonitoring();
    mainWindow?.webContents.send("monitoring-status", false);
  });

  powerMonitor.on("unlock-screen", async () => {
    console.log("[POWER] Screen unlocked");

    const wasRunning = store.get("timerWasRunning");
    if (wasRunning && isMonitoring) {
      store.delete("timerWasRunning");
      const project = currentTimerEntry?.project || null;
      const notes = currentTimerEntry?.notes || null;
      await startTimer(project, notes);
    }

    refreshTodayStats();
  });
  function formatSeconds(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  console.log("formatSeconds", formatSeconds(3661)); // Should print "01:01:01"

  async function refreshTodayStats() {
    const token = store.get("authToken") || store.get("agentToken");
    if (!token) return;

    try {
      const res = await apiFetch("/api/agent/timer/status");
      const seconds = res.todayStats?.totalSeconds || 0;
      mainWindow.webContents.send("update-time-tracked", formatSeconds(seconds));
    } catch (err) {
      console.error("[TIMER] Failed to fetch total time:", err);
      mainWindow.webContents.send("update-time-tracked", "00:00:00");
    }
  }

  // Call on app ready and on unlock
  app.whenReady().then(refreshTodayStats);
  powerMonitor.on("unlock-screen", refreshTodayStats);

  // -----------------------------
  // WINDOW & TRAY
  // -----------------------------
  createWindow();
  createTray();

  // -----------------------------
  // AUTO-START MONITORING
  // -----------------------------
  const authToken = store.get("authToken");
  const agentToken = store.get("agentToken");
  const token = authToken || agentToken;
  const autoStart = store.get("settings")?.autoStartMonitoring;

  if (token && autoStart !== false) {
    setTimeout(async () => {
      const serverOk = await checkServerConnection();
      if (serverOk) {
        console.log("[MAIN] Server is reachable, starting monitoring...");
        startMonitoring();
      } else {
        console.log("[MAIN] Server not reachable, monitoring will not auto-start");
      }
    }, 3000);
  }

  console.log("=== DESKTOP AGENT READY ===");
});

function logoutUser() {
  store.delete("authToken");
  store.delete("agentToken");
  global.timerRunning = false;
  global.isMonitoring = false;
  console.log("[MAIN] User logged out due to sleep/lock");
}

app.on("window-all-closed", () => {
  // Don't quit - keep running in tray
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
  stopMonitoring();
});
