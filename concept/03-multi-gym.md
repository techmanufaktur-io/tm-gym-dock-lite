# Phase 4 — Multi-Gym & White-Label Branding

> One codebase, many gyms. Each with its own look.

## Features

### 4.1 Full URL-Driven Configuration
Already started with `?gym=savvyGYM`. Extend to:
```
?gym=FitCorp&color=ff6b35&logo=FitCorp&lang=de
```
- `gym` — Gym name (already works)
- `color` — Accent color (hex, no #)
- `logo` — Text logo override
- `lang` — Language (en/de)
- All persisted to localStorage on first visit
- **Effort:** ~40 lines JS

### 4.2 Per-Gym Google Sheet Routing
- URL param: `?sheet=SHEET_ID`
- Or: one master Sheet with a "Gyms" tab routing gym names to Sheet IDs
- Each gym operator gets their own Sheet — full data isolation
- **Effort:** ~20 lines in .gs, ~10 lines JS

### 4.3 Custom QR Code Generator
- New admin page: `poster.html?gym=FitCorp&color=ff6b35`
- Poster auto-generates with the gym's branding
- Print-ready, no design skills needed
- **Effort:** Already mostly built, ~20 lines for color param

### 4.4 Language Toggle
- Currently: UI in English, rules in German
- Add: full German mode via `?lang=de` or toggle in settings
- Store translations as a JS object (not i18n library — keep it light)
- ~50 translatable strings
- **Effort:** ~80 lines JS

## Priority

| Feature | Impact | Effort | Recommendation |
|---------|--------|--------|----------------|
| URL Config (color/logo) | High | Low | Quick win for sales |
| QR Generator with branding | High | Low | Already 80% done |
| Per-Gym Sheet Routing | High | Low | Required for multi-tenant |
| Language Toggle | Medium | Medium | DE/EN covers 90% of market |

## Selling Point

> "Your gym, your brand, your colors. Ready in 2 minutes."
