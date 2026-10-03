# Phase 5 — Smart Features

> Intelligence without complexity.

## Features

### 5.1 Capacity Limit & Wait Indicator
- Set max capacity via URL param or settings: `?capacity=8`
- Check-in screen shows: "3/8 currently training"
- If full: "Gym is full — try again later" (block check-in)
- Uses `?action=active` endpoint (already exists)
- **Effort:** ~50 lines JS, no backend changes

### 5.2 Peak Hours Chart
- Small bar chart on check-in screen: "Busy hours today"
- Data from backend: `?action=peak` returns hourly counts
- Helps users avoid crowded times
- Rendered with pure CSS bars (no chart library)
- **Effort:** ~40 lines JS/CSS, ~30 lines .gs

### 5.3 Equipment Booking (Lightweight)
- List of equipment in settings (e.g., "Treadmill 1", "Squat Rack")
- On check-in: optionally select what you'll use
- Shows availability on check-in screen
- Purely informational — no hard locks
- **Effort:** ~100 lines JS/HTML, ~20 lines .gs

### 5.4 Maintenance / Out of Order Flag
- Admin can mark equipment as out of order via URL:
  `?admin=1&action=maintenance&item=Treadmill+1`
- Shows banner on check-in screen: "Treadmill 1 is currently out of order"
- Stored in a "Status" tab in Google Sheets
- **Effort:** ~40 lines JS, ~30 lines .gs

### 5.5 Shelly Integration Enhancements
- Already have: motion alert when no one is checked in
- Add: auto-lights (Shelly relay) when someone checks in
- Add: auto-off lights 15 min after last checkout
- Requires Shelly Cloud API calls from Apps Script
- **Effort:** ~60 lines .gs

### 5.6 Guest Check-in (No Profile)
- Quick guest mode: scan QR, enter name, check in — no profile saved
- For visitors, one-time users, trial sessions
- Marked as "Guest" in Google Sheets
- **Effort:** ~30 lines JS

## Priority

| Feature | Impact | Effort | Recommendation |
|---------|--------|--------|----------------|
| Capacity Limit | High | Low | Big selling point |
| Guest Check-in | Medium | Low | Easy win |
| Peak Hours | Medium | Medium | Nice differentiator |
| Maintenance Flag | Medium | Low | Practical value |
| Equipment Booking | Low | Medium | Only if requested |
| Shelly Automation | Low | Medium | Cool but niche |

## Selling Point

> "Know when it's busy. Know what's available. Zero overhead."
