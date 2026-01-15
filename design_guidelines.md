# Design Guidelines: Remote Team Monitoring Platform

## Design Approach
**System-Based Approach**: Drawing from Linear's clean aesthetics and enterprise dashboard patterns (Datadog, Mixpanel) for data-heavy, professional monitoring tools. This is a utility-focused application where clarity, trust, and efficiency drive user experience.

## Core Design Principles
- **Professional Trust**: Clean, corporate aesthetic suitable for enterprise monitoring
- **Data Clarity**: Information hierarchy that makes activity patterns immediately scannable
- **Minimal Distraction**: No unnecessary animations - this is a work tool
- **Dashboard-First**: Lead with data, not marketing

---

## Typography
- **Primary Font**: Inter (Google Fonts) - excellent for data-heavy interfaces
- **Monospace**: JetBrains Mono for timestamps and technical data
- **Hierarchy**:
  - Page Headers: text-3xl font-bold
  - Section Headers: text-xl font-semibold
  - Card Titles: text-lg font-medium
  - Body Text: text-base font-normal
  - Metadata/Timestamps: text-sm text-gray-600
  - Micro Labels: text-xs uppercase tracking-wide

## Layout System
- **Spacing Primitives**: Tailwind units of 2, 4, 6, 8, and 12 (p-4, gap-6, mb-8, etc.)
- **Container Widths**: max-w-7xl for main content areas
- **Grid Systems**: 
  - Screenshot gallery: grid-cols-2 md:grid-cols-3 lg:grid-cols-4
  - Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3

---

## Page Structure & Layouts

### Dashboard Homepage
**Layout**: Sidebar navigation (w-64) + main content area
- **Top Bar**: User switcher dropdown, date range selector, live status indicator
- **Key Metrics Row**: 3-4 stat cards showing: Active Users, Total Screenshots Today, Average Activity %, Top Performer
- **Activity Timeline**: Horizontal timeline showing team activity across the day with color-coded blocks
- **Recent Screenshots Grid**: 3x4 grid of latest team screenshots with hover overlays showing user name and timestamp
- **Team Status List**: Table view of all team members with real-time status (Active/Idle), last screenshot time, activity score

### Screenshot Gallery
**Layout**: Filter sidebar (w-80) + masonry grid
- **Filters Panel**: User selection, date range picker, activity level filters
- **Grid Display**: 3-4 column masonry layout, each screenshot card includes:
  - Screenshot thumbnail (aspect-ratio-video)
  - User avatar + name
  - Precise timestamp
  - Activity indicators (mouse clicks, keyboard presses shown as badges)
- **Lightbox View**: Click to expand with navigation arrows, full metadata panel

### Individual Team Member View
**Layout**: Two-column split (60/40)
- **Left Column**: 
  - User header card (avatar, name, status, current activity)
  - Activity heatmap calendar (contribution graph style)
  - Screenshot timeline (chronological list)
- **Right Column**:
  - Live activity feed
  - Today's statistics panel
  - Activity pattern chart (line graph)

### Settings/Admin Panel
**Layout**: Tabbed interface
- Tabs: Team Members, Screenshot Settings, Activity Thresholds, Privacy Controls
- Form-heavy layouts with clear sections and help text

---

## Component Library

### Navigation
- **Sidebar**: Fixed left sidebar with icon + label nav items, collapsed state on mobile
- **Top Bar**: Sticky header with global controls, user menu, notification bell

### Data Display
- **Stat Cards**: Rounded cards (rounded-lg) with large number, label, and trend indicator
- **Activity Timeline**: Horizontal bar chart with time markers, color-coded segments for active/idle
- **Screenshot Cards**: Aspect-ratio containers with overlay on hover, rounded corners
- **Data Tables**: Striped rows, sticky headers, sortable columns, status badges
- **Charts**: Use Recharts for line graphs and bar charts - simple, uncluttered style

### Forms & Controls
- **Date Picker**: Calendar popup with range selection
- **Dropdowns**: Clean select menus with search for user lists
- **Toggle Switches**: For enabling/disabling monitoring features
- **Slider Controls**: For screenshot interval settings (e.g., every 5-30 minutes)

### Status Indicators
- **Live Status Dots**: Small circular indicators (green=active, yellow=idle, gray=offline)
- **Activity Badges**: Pill-shaped badges showing click count, keypress count
- **Progress Bars**: Linear progress for activity percentage scores

### Modals & Overlays
- **Screenshot Lightbox**: Full-screen overlay with dark backdrop, navigation controls
- **Confirmation Dialogs**: Simple centered modals for delete/disable actions
- **Settings Panels**: Slide-out drawer from right for quick settings access

---

## Images

### Dashboard Placeholder Content
- **User Avatars**: Use placeholder circles with initials or default avatar icons
- **Screenshots**: Gray placeholder boxes with camera icon and "Screenshot Preview" text during development
- **Empty States**: Illustration of a clock/monitor with "No activity recorded yet" messaging

### Visual Elements
- **Icons**: Use Heroicons (via CDN) throughout - outline style for sidebar nav, solid style for status indicators
- **No hero images**: This is a dashboard application, not a marketing site
- **Charts/Graphs**: Generated via Recharts library, not static images

---

## Key Interactions
- **Screenshot Hover**: Subtle scale transform, overlay appears with metadata
- **Status Updates**: Real-time WebSocket updates for team status changes (no animation)
- **Table Sorting**: Instant sort with arrow indicators
- **Filter Application**: Immediate results update when filters change
- **Lightbox Navigation**: Keyboard arrows and click to advance through screenshots

## Accessibility
- Consistent form input styling with clear labels and focus states
- ARIA labels for status indicators and icon-only buttons
- Keyboard navigation for screenshot gallery and lightbox
- High contrast for status colors (WCAG AA compliant)