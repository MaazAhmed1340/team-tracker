# TeamTrack - Remote Team Monitoring Platform

## Overview

TeamTrack is a remote team monitoring platform that provides real-time activity tracking through automated screenshots, keyboard/mouse activity metrics, and productivity insights. The application follows a dashboard-first design philosophy with a professional, enterprise-grade aesthetic suitable for workplace monitoring tools.

The platform enables managers to monitor remote team members' work activity, view screenshots captured at configurable intervals, track productivity scores, and manage team settings.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful JSON API endpoints under `/api/*`
- **Real-time Updates**: WebSocket server for live data synchronization (status changes, new screenshots)
- **Static Serving**: Express static middleware serves built frontend in production

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Database**: PostgreSQL (connection via `DATABASE_URL` environment variable)
- **Migrations**: Drizzle Kit for schema migrations (`drizzle-kit push`)

### Data Models
- **Team Members**: User profiles with monitoring settings, status tracking
- **Screenshots**: Captured images with activity metrics (clicks, keystrokes, activity score)
- **Activity Logs**: Event-based logging for detailed activity tracking
- **Time Entries**: Start/stop timer records with duration, project, notes, and idle time tracking
- **Agent Tokens**: Authentication tokens for desktop agent connections
- **App Usage**: Application/website tracking with duration, app type, and window titles

### Project Structure
```
├── client/src/           # React frontend application
│   ├── components/       # Reusable UI components
│   ├── pages/           # Route page components
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Utilities and providers
├── server/              # Express backend
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Database access layer
│   └── db.ts            # Database connection
├── shared/              # Shared code between client/server
│   └── schema.ts        # Drizzle database schema
└── migrations/          # Database migration files
```

### Design Patterns
- **Path Aliases**: `@/` maps to client source, `@shared/` maps to shared code
- **API Layer**: Centralized `apiRequest` function for consistent HTTP calls
- **Query Invalidation**: WebSocket messages trigger React Query cache invalidation for real-time updates
- **Theme System**: CSS custom properties with class-based dark mode toggle

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection string via `DATABASE_URL` environment variable

### UI Component Libraries
- **Radix UI**: Accessible primitive components (dialogs, dropdowns, tooltips, etc.)
- **shadcn/ui**: Pre-styled component collection using Radix primitives
- **Lucide React**: Icon library

### Key NPM Packages
- **drizzle-orm / drizzle-kit**: Database ORM and migration tooling
- **@tanstack/react-query**: Server state management
- **react-hook-form / @hookform/resolvers**: Form handling with Zod validation
- **date-fns**: Date formatting and manipulation
- **zod / drizzle-zod**: Schema validation and type inference
- **ws**: WebSocket server implementation
- **recharts**: Charts and data visualization for reports

### Features
- **Dashboard**: Overview with stats, activity timeline, recent screenshots, team status
- **Screenshots**: Gallery view with filtering and lightbox
- **Team Management**: Team member list, detail views with activity and time tracking
- **Time Tracking**: Start/stop timers, project assignment, idle time detection
- **App/Website Tracking**: Active window monitoring, daily usage summaries
- **Reports**: Date range analytics with productivity charts, time breakdown, app usage, CSV export

### Development Tools
- **Vite**: Development server and build tool
- **esbuild**: Server bundle optimization for production
- **tsx**: TypeScript execution for development