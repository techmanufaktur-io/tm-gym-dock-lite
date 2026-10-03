# Phase 3 — Admin Dashboard & Insights

> Give gym operators visibility without leaving Google Sheets.

## Features

### 3.1 Live Occupancy Display
- New screen/tab: "Who's here now?"
- Calls `?action=active` endpoint (already exists in backend)
- Shows list of currently checked-in users with elapsed time
- Useful for: fire safety, capacity limits, community feeling
- **Effort:** ~60 lines JS/HTML, no backend changes

### 3.2 Google Sheets Dashboard Template
- Pre-built Sheet with pivot tables and charts:
  - Check-ins per day/week/month
  - Peak hours heatmap
  - Top users (most sessions)
  - Average session duration
  - Unique users per week trend
- Delivered as a template Sheet users can copy
- **Effort:** Spreadsheet work only, no code

### 3.3 Checkout Tracking in Backend
- Extend Apps Script to handle `?action=checkout`
- Add columns: Checkout Time, Duration (min), Auto-Checkout flag
- Enables server-side session duration reporting
- **Effort:** ~30 lines in .gs file

### 3.4 Daily/Weekly Summary Email
- Scheduled Apps Script trigger (daily at 22:00)
- Email to admin: sessions today, unique users, total hours, peak hour
- Reuses existing MailApp integration
- **Effort:** ~60 lines in .gs file

### 3.5 Admin PIN Screen
- Simple PIN-protected admin view within the PWA
- PIN stored in settings (not security-critical — this is a gym, not a bank)
- Shows: current occupancy, today's check-ins, quick stats
- **Effort:** ~80 lines JS/HTML/CSS

## Priority

| Feature | Impact | Effort | Recommendation |
|---------|--------|--------|----------------|
| Checkout in Backend | High | Low | Do first (enables reporting) |
| Sheets Dashboard | High | Low | Deliver as template |
| Daily Summary Email | High | Medium | High value for operators |
| Live Occupancy | Medium | Low | Great selling point |
| Admin PIN Screen | Medium | Medium | Phase 3b |

## Selling Point

> "See who's training, when, and how long — right in your inbox every morning."
