# Team Tracker - About

## What is Team Tracker?

Team Tracker is a **remote team monitoring platform** that helps managers and team leads track their team's productivity and activity. It's designed for remote teams who need visibility into work patterns, time tracking, and activity monitoring.

## What Does It Do?

Team Tracker consists of three main parts:

### 1. **Web Dashboard** (The Main Application)
A beautiful web interface where managers can:
- View real-time activity of all team members
- See screenshots captured from team members' computers
- Monitor activity levels (mouse clicks, keyboard activity)
- Track time worked by each team member
- View detailed reports and analytics
- Manage team members and settings
- See which applications/websites team members are using

### 2. **Backend Server** (The Brain)
A server that:
- Stores all data in a PostgreSQL database
- Provides REST API endpoints for the dashboard
- Handles real-time updates via WebSocket
- Manages authentication and security
- Processes screenshots and activity data

### 3. **Desktop Agent** (The Monitor)
An Electron desktop application that:
- Runs on each team member's computer
- Captures screenshots at regular intervals
- Tracks mouse clicks and keyboard activity
- Monitors which applications are being used
- Sends data to the server
- Runs quietly in the system tray

## Key Features

### 📊 Dashboard Overview
- **Real-time Status**: See who's online, idle, or offline
- **Activity Timeline**: Visual timeline showing team activity throughout the day
- **Recent Screenshots**: Quick view of latest screenshots from all team members
- **Team Statistics**: Overview cards showing active users, total screenshots, average activity

### 👥 Team Management
- Add, edit, and remove team members
- View individual team member details
- Track each member's activity and productivity
- Set privacy settings per team member

### 📸 Screenshot Gallery
- Browse all screenshots captured from team members
- Filter by team member, date range, or activity level
- View screenshots in a lightbox (full-screen viewer)
- Option to blur sensitive content

### ⏱️ Time Tracking
- Automatic time tracking when team members are active
- Manual time entry support
- Project-based time tracking
- Idle time detection
- Daily, weekly, and monthly reports

### 📱 Activity Monitoring
- Mouse click tracking
- Keyboard activity tracking
- Application usage tracking (which apps are being used)
- Website/URL tracking (which websites are visited)
- Activity score calculation

### 🔒 Privacy Controls
- Privacy mode (pauses all monitoring)
- Screenshot blurring options
- Control app and URL tracking
- Work hours configuration
- Per-member privacy settings

### 📈 Reports & Analytics
- Productivity reports by date range
- Time breakdown by team member
- Application usage statistics
- Activity trends over time
- Export capabilities

## Technology Stack

### Frontend (Web Dashboard)
- **React** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI component library
- **TanStack Query** - Data fetching
- **Wouter** - Routing
- **Recharts** - Charts and graphs
- **WebSocket** - Real-time updates

### Backend (Server)
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **PostgreSQL** - Database
- **Drizzle ORM** - Database toolkit
- **WebSocket (ws)** - Real-time communication
- **Zod** - Data validation

### Desktop Agent
- **Electron** - Desktop app framework
- **Node.js** - Runtime
- **screenshot-desktop** - Screenshot capture
- **active-win** - Active window detection
- **iohook** - Mouse/keyboard tracking

## How It Works

1. **Setup**: 
   - Manager sets up the web dashboard on a server
   - Creates team member accounts
   - Each team member installs the desktop agent

2. **Registration**:
   - Team member opens the desktop agent
   - Enters their Team Member ID (provided by manager)
   - Agent connects to the server and gets an authentication token

3. **Monitoring**:
   - Desktop agent captures screenshots at set intervals (e.g., every 5 minutes)
   - Tracks mouse clicks, keystrokes, and active applications
   - Sends this data to the server via secure API calls
   - Server stores everything in the database

4. **Viewing**:
   - Manager opens the web dashboard
   - Sees real-time updates via WebSocket
   - Views screenshots, activity data, and reports
   - Can filter and analyze data

## Use Cases

- **Remote Team Management**: Monitor productivity of remote employees
- **Time Tracking**: Track billable hours and project time
- **Activity Monitoring**: Understand work patterns and productivity
- **Compliance**: Maintain records of work activity
- **Performance Analysis**: Identify productivity trends and patterns

## Privacy & Ethics

This tool is designed for legitimate business monitoring with proper consent. It includes:
- Privacy controls for team members
- Blur options for sensitive content
- Work hours configuration
- Transparency in what's being monitored

**Important**: Always ensure team members are aware of monitoring and have given consent. Check local laws regarding employee monitoring.

## Project Structure

```
Team-Tracker/
├── client/              # React web dashboard frontend
│   ├── src/
│   │   ├── components/  # React UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utility functions
│   └── index.html       # HTML entry point
├── server/              # Express.js backend server
│   ├── index.ts         # Server entry point
│   ├── routes.ts        # API route handlers
│   ├── storage.ts       # Database operations
│   └── db.ts            # Database connection
├── desktop-agent/       # Electron desktop application
│   └── src/
│       ├── main.js      # Electron main process
│       └── preload.js   # Preload script
├── shared/              # Shared TypeScript types and schemas
│   └── schema.ts        # Database schema definitions
└── script/             # Build scripts
    └── build.ts         # Production build script
```

## Who Is This For?

- **Team Managers**: Who need visibility into remote team activity
- **Project Managers**: Who need time tracking and productivity metrics
- **HR Departments**: Who need compliance and activity records
- **Business Owners**: Who want to understand team productivity patterns

---

**Note**: This is a monitoring tool. Always use responsibly and with proper consent from all team members.
