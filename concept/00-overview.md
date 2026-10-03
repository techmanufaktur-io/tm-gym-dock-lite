# savvyGYM Concept — Product Roadmap

## Vision

savvyGYM is a lightweight, zero-infrastructure gym check-in system for small studios, company gyms, and co-working fitness spaces. It runs as a single-file PWA with a Google Sheets backend — no server, no database, no monthly costs.

**Target customers:**
- Companies with an in-house gym (employee benefit)
- Co-working spaces with a small fitness area
- Small independent studios (1-3 locations)
- Building managers offering shared gym facilities

**Core value proposition:**
> "Gym management in 5 minutes. QR code on the wall, done."

## Current State (Phase 1)

- Single-file PWA (HTML + CSS + JS)
- Check-in / check-out with live timer
- Google Sheets backend via Apps Script
- Shelly motion sensor integration (security alerts)
- History with duration tracking and stats
- German rules / terms of use
- PWA installable with auto-update detection
- QR code poster (printable DIN A4)

## Proposed Phases

| Phase | Theme | Effort | Files |
|-------|-------|--------|-------|
| 2 | Engagement & Retention | Small | [01-engagement.md](01-engagement.md) |
| 3 | Admin & Insights | Medium | [02-admin-dashboard.md](02-admin-dashboard.md) |
| 4 | Multi-Gym & Branding | Small | [03-multi-gym.md](03-multi-gym.md) |
| 5 | Smart Features | Medium | [04-smart-features.md](04-smart-features.md) |
| 6 | Monetization | — | [05-monetization.md](05-monetization.md) |

## Architecture Principle

Every feature must work within the existing constraints:
- **Single HTML file** — no build step, no npm, no bundler
- **Google Sheets backend** — no server to maintain
- **Offline-first** — works without internet, syncs when available
- **< 100KB total** — fast on any device, any network
- **Zero config for end users** — scan QR, register, train
