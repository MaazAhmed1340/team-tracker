# Team Tracker - Setup Guide

This guide will walk you through setting up the Team Tracker remote team monitoring platform. The platform consists of three main components:

1. **Web Dashboard & Backend Server** - The main application
2. **Desktop Agent** - Electron app for team members
3. **PostgreSQL Database** - Data storage

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v20 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **PostgreSQL** (v16 or higher) - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/)

For building the desktop agent:
- **Windows**: No additional requirements
- **macOS**: Xcode Command Line Tools
- **Linux**: `libnss3-dev`, `libatk-bridge2.0-dev`, `libdrm2`, `libxkbcommon-dev`, `libxcomposite-dev`, `libxdamage-dev`, `libxrandr-dev`, `libgbm-dev`, `libxss1`, `libasound2-dev`

---

## Step 1: Clone the Repository ✅

```bash
git clone <repository-url>
cd Team-Tracker
```

---

## Step 2: Database Setup ✅

### 2.1 Create PostgreSQL Database

1. Open PostgreSQL (pgAdmin, psql, or your preferred client)
2. Create a new database:

```sql
CREATE DATABASE teamtrack;
```

### 2.2 Configure Database Connection ✅

The database connection is configured in `server/db.ts`. You have two options:

**Option A: Environment Variable (Recommended)**
Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/teamtrack
```

**Option B: Direct Configuration**
Edit `server/db.ts` and update the connection string:

```typescript
export const pool = new Pool({ 
  connectionString: "postgresql://username:password@localhost:5432/teamtrack" 
});
```

### 2.3 Initialize Database Schema ✅

Run the database migration to create all necessary tables:

```bash
npm run db:push
```

This will create all tables defined in `shared/schema.ts`:
- `team_members`
- `screenshots`
- `activity_logs`
- `time_entries`
- `agent_tokens`
- `app_usage`

---

## Step 3: Install Dependencies ✅

### 3.1 Main Application (Web Dashboard + Server)

From the root directory:

```bash
npm install
```

This installs dependencies for:
- React frontend (web dashboard)
- Express.js backend server
- Database ORM (Drizzle)
- All UI components and utilities

### 3.2 Desktop Agent

Navigate to the desktop agent directory and install dependencies:

```bash
cd desktop-agent
npm install
cd ..
```

**Note**: The `iohook` package has been removed from dependencies as it's not currently used and can cause installation issues on some systems. If you need mouse/keyboard tracking in the future, you may need to add it back with proper configuration.

---

## Step 4: Configuration

### 4.1 Server Configuration

The server runs on port `5000` by default. You can change this by setting the `PORT` environment variable:

```bash
# Linux/macOS
export PORT=3000

# Windows (PowerShell)
$env:PORT=3000

# Or create a .env file
PORT=3000
```

### 4.2 Desktop Agent Configuration

The desktop agent will prompt for configuration on first launch:
- **Server URL**: The URL where your server is running (e.g., `http://localhost:5000` or `https://your-domain.com`)
- **Team Member ID**: Provided by the admin after creating a team member
- **Device Name**: A friendly name for the device (e.g., "Work Laptop")
- **Platform**: Windows, macOS, or Linux

---

## Step 5: Running the Application

### 5.1 Development Mode

**Start the Web Dashboard & Server:**

```bash
npm run dev
```

This will:
- Start the Express.js server on port 5000 (or your configured PORT)
- Start the Vite development server for hot-reloading
- Enable WebSocket connections for real-time updates

Open your browser and navigate to:
```
http://localhost:5000
```

**Start the Desktop Agent:**

In a new terminal:

```bash
cd desktop-agent
npm start
```

### 5.2 Production Mode ❌

**Build the Application:**

```bash
npm run build
```

This will:
- Build the React frontend to `server/public/`
- Bundle the server code to `dist/index.cjs`

**Start the Production Server:**

```bash
npm start
```

The server will serve the built frontend and API on the configured port.

---

## Step 6: Building the Desktop Agent

### 6.1 Development Build

The desktop agent can be run directly in development:

```bash
cd desktop-agent
npm start
```

### 6.2 Production Builds

Build platform-specific installers:

**Windows:**
```bash
cd desktop-agent
npm run build:win
```

Output: `desktop-agent/dist/TeamTrack Agent Setup.exe`

**macOS:**
```bash
cd desktop-agent
npm run build:mac
```

Output: `desktop-agent/dist/TeamTrack Agent.dmg`

**Linux:**
```bash
cd desktop-agent
npm run build:linux
```

Output: `desktop-agent/dist/TeamTrack Agent.AppImage`

**All Platforms:**
```bash
cd desktop-agent
npm run build
```

---

## Step 7: Initial Setup

### 7.1 Access the Web Dashboard

1. Open your browser and go to `http://localhost:5000` (or your configured URL)
2. You should see the Team Tracker dashboard

### 7.2 Create Your First Team Member

1. Navigate to the **Team** page
2. Click **Add Team Member**
3. Fill in the details:
   - Name
   - Email
   - Role (optional)
4. Click **Save**

**Important**: Note the **Team Member ID** - you'll need this for the desktop agent setup.

### 7.3 Configure Settings

1. Go to **Settings**
2. Configure:
   - **Screenshot Interval**: How often screenshots are captured (default: 5 minutes)
   - **Activity Tracking**: Enable/disable mouse and keyboard tracking
   - **Idle Threshold**: Minutes of inactivity before marking as idle
   - **Auto-start Monitoring**: Whether agents should start monitoring automatically

### 7.4 Connect Desktop Agent

1. Launch the desktop agent
2. Enter the configuration:
   - **Server URL**: `http://localhost:5000` (or your server URL)
   - **Team Member ID**: The ID from step 7.2
   - **Device Name**: A name for this device
   - **Platform**: Select your OS
3. Click **Connect Device**
4. Once connected, click **Start Monitoring** to begin capturing screenshots

---

## Step 8: File Structure

```
Team-Tracker/
├── client/                 # React web dashboard frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # React hooks
│   │   └── lib/            # Utilities
│   └── index.html
├── server/                 # Express.js backend
│   ├── index.ts            # Server entry point
│   ├── routes.ts           # API routes
│   ├── storage.ts          # Database operations
│   └── db.ts               # Database connection
├── desktop-agent/          # Electron desktop app
│   ├── src/
│   │   ├── main.js         # Electron main process
│   │   ├── preload.js      # Preload script
│   │   └── renderer/       # UI HTML/CSS/JS
│   └── assets/             # Icons and assets
├── shared/                 # Shared TypeScript code
│   └── schema.ts           # Database schema
└── script/                 # Build scripts
    └── build.ts            # Production build script
```

---

## Step 9: Environment Variables

Create a `.env` file in the root directory (optional):

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/teamtrack

# Server
PORT=5000
NODE_ENV=production

# Optional: Add other configuration here
```

---

## Step 10: Troubleshooting

### Database Connection Issues

**Error**: `Connection refused` or `database does not exist`

**Solutions**:
1. Verify PostgreSQL is running: `pg_isready` or check service status
2. Verify database exists: `psql -l`
3. Check connection string in `server/db.ts` or `.env`
4. Ensure PostgreSQL is listening on the correct port (default: 5432)

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::5000`

**Solutions**:
1. Change the PORT environment variable
2. Find and stop the process using port 5000:
   ```bash
   # Linux/macOS
   lsof -ti:5000 | xargs kill
   
   # Windows
   netstat -ano | findstr :5000
   taskkill /PID <PID> /F
   ```

### Desktop Agent Won't Connect

**Error**: Connection failed or timeout

**Solutions**:
1. Verify the server is running and accessible
2. Check the Server URL is correct (include `http://` or `https://`)
3. Ensure firewall allows connections to the server port
4. Check server logs for authentication errors
5. Verify the Team Member ID is correct

### Screenshot Capture Fails

**Error**: Screenshots not being captured

**Solutions**:
1. Check desktop agent logs for errors
2. Verify monitoring is started (green indicator)
3. Check privacy mode is disabled
4. Ensure proper permissions:
   - **macOS**: System Preferences → Security & Privacy → Screen Recording
   - **Windows**: Usually works without additional permissions
   - **Linux**: May need `x11-utils` package

### Desktop Agent: Electron Not Found

**Error**: `Cannot find module 'electron/cli.js'` or `Error: Cannot find module 'electron'`

**Solutions**:
1. Navigate to the desktop-agent directory:
   ```bash
   cd desktop-agent
   ```

2. Delete node_modules and package-lock.json:
   ```bash
   # Windows (PowerShell)
   Remove-Item -Recurse -Force node_modules, package-lock.json
   
   # Linux/macOS
   rm -rf node_modules package-lock.json
   ```

3. Reinstall dependencies:
   ```bash
   npm install
   ```

4. If Electron still fails to install, try installing it explicitly:
   ```bash
   npm install electron --save-dev
   ```

5. Verify Electron is installed:
   ```bash
   npx electron --version
   ```

6. If you're behind a corporate firewall or proxy, you may need to configure npm:
   ```bash
   npm config set proxy http://proxy.company.com:8080
   npm config set https-proxy http://proxy.company.com:8080
   ```

### Desktop Agent: iohook Installation Fails

**Error**: `iohook` prebuild not found or installation fails

**Solutions**:
1. The `iohook` package is not currently used in the codebase and has been removed from dependencies
2. If you encounter this error, ensure your `package.json` doesn't include `iohook` in dependencies
3. If you need mouse/keyboard tracking, consider using alternative packages that are better maintained
4. For now, the desktop agent works without `iohook` - activity tracking uses other methods

### Build Errors

**Error**: Build fails with missing dependencies

**Solutions**:
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. For desktop agent, ensure all system dependencies are installed
4. Check Node.js version: `node --version` (should be v20+)
5. On Windows, you may need to install build tools:
   ```bash
   npm install --global windows-build-tools
   ```

---

## Step 11: Security Considerations

### Production Deployment

1. **Use HTTPS**: Never use HTTP in production. Set up SSL/TLS certificates.
2. **Secure Database**: Use strong passwords and restrict database access
3. **Environment Variables**: Never commit `.env` files to version control
4. **Firewall**: Restrict access to the server port
5. **Authentication**: Consider adding authentication to the web dashboard
6. **Token Security**: Agent tokens are stored securely, but rotate them periodically

### Privacy & Compliance

- Ensure all team members are aware of monitoring
- Obtain proper consent before monitoring
- Check local laws regarding employee monitoring
- Use privacy features (blur screenshots, work hours) appropriately

---

## Step 12: Next Steps

After setup is complete:

1. **Add Team Members**: Create accounts for all team members
2. **Distribute Desktop Agent**: Share the built installer with team members
3. **Configure Settings**: Adjust screenshot intervals and activity tracking
4. **Set Privacy Controls**: Configure privacy settings per team member
5. **Monitor Activity**: Start viewing team activity on the dashboard

---

## Additional Resources

- **About.md**: Overview of the platform and features
- **design_guidelines.md**: UI/UX design guidelines
- **desktop-agent/README.md**: Desktop agent specific documentation

---

## Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Review server logs for error messages
3. Check desktop agent console for errors
4. Verify all prerequisites are installed correctly
5. Ensure database schema is properly initialized

---

## Quick Start Summary

```bash
# 1. Install dependencies
npm install
cd desktop-agent && npm install && cd ..

# 2. Set up database
# Create PostgreSQL database and update connection in server/db.ts

# 3. Initialize schema
npm run db:push

# 4. Start development server
npm run dev

# 5. In another terminal, start desktop agent
cd desktop-agent
npm start
```

That's it! You should now have Team Tracker up and running. 🎉
