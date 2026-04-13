# savvyGYM – Project Instructions

## Deployment Checklist

**Before every commit & push**, bump the service worker cache version in `sw.js`:

```
const CACHE = 'savvygym-vX';  // increment X
```

This is **mandatory** — without it, installed PWAs won't detect the update and users won't see the "Update available" banner. The version number must be incremented even for small changes.

Current version: `savvygym-v4`

## Architecture

- Single-file PWA (`index.html`) — all HTML, CSS, JS in one file
- `sw.js` — Service Worker with network-first for HTML, cache-first for assets
- `manifest.json` — PWA manifest, name: "savvyGYM by techmanufaktur"
- `poster.html` — Printable DIN A4 poster (2 pages: QR code + rules)
- `gymdock-backend.gs` — Google Apps Script backend (copy to script.google.com)

## Backend

- Google Apps Script receives check-ins via **GET with URL params** (not POST — Apps Script 302 redirects lose POST body)
- Apps Script URL is hardcoded in `index.html` as `API_URL`
- Data sent: name, email, company, timestamp, date, time, gym

## Key Behaviors

- `?gym=savvyGYM` URL param gets persisted to localStorage so it survives homescreen install
- When gym is set via URL param, the field is locked (readonly) in registration
- Existing users without `company` field in their profile are prompted to re-register (name/email pre-filled)
- All UI text is in English
- Color scheme: dark background with neon blue (#00d4ff) accent

## Branding

- Name: **savvyGYM** (short) / **savvyGYM by techmanufaktur** (full)
- Accent color (app): `#00d4ff` (neon blue)
- Accent color (poster): `#0b5caa` (savvytec blue, rgb 11 92 170)
