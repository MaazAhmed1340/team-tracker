# TeamTrack Desktop Agent

A cross-platform desktop agent for the TeamTrack remote team monitoring platform.

## Features

- **System Tray Integration**: Runs silently in the background with easy access from the system tray
- **Automatic Screenshot Capture**: Captures screenshots at configurable intervals
- **Activity Tracking**: Monitors keyboard and mouse activity for productivity metrics
- **Real-time Status Updates**: Sends heartbeats to keep status synchronized with the web dashboard
- **Secure Authentication**: Uses bearer tokens for secure API communication

## Installation

### Development Setup

1. Navigate to the desktop-agent directory:
   ```bash
   cd desktop-agent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the application:
   ```bash
   npm start
   ```

### Building for Distribution

Build for your platform:

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

The built application will be in the `dist` folder.

## Configuration

When first launching the app, you'll need to:

1. Enter the server URL (your TeamTrack web app URL)
2. Enter your Team Member ID (get this from your admin)
3. Give your device a name (e.g., "Work Laptop")
4. Select your platform

After connecting, the agent will:
- Start monitoring automatically (configurable)
- Capture screenshots at the interval set by your admin
- Track keyboard and mouse activity
- Send regular status updates

## Tray Menu Options

Right-click the tray icon to access:
- **Start/Stop Monitoring**: Toggle activity capture
- **Settings**: Open the settings window
- **Quit**: Exit the application

## Security

- All communication uses HTTPS in production
- Authentication tokens are stored securely using electron-store
- Screenshots are transmitted as base64-encoded images
- No data is stored locally after transmission

## System Requirements

- Windows 10 or later
- macOS 10.13 or later
- Ubuntu 18.04 or later (or equivalent)

## Adding Tray Icon

Place your tray icon as `assets/tray-icon.png` (16x16 or 22x22 pixels recommended).

For Windows, also add `assets/icon.ico` (256x256).
For macOS, add `assets/icon.icns`.
