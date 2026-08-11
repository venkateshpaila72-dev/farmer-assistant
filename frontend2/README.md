# Farmer Assistant — Frontend 2 (Clean UI)

A clean, simple, mobile-friendly React UI for the existing Farmer Assistant
backend (`../backend`). It is a fresh rewrite — the old `../frontend` folder
is kept only as a reference.

## Run

```bash
npm install
npm run dev        # http://localhost:5173 (proxies /api and /ws to :8000)
npm run build      # production build
```

Start the backend first (`uvicorn app.main:app --reload` inside `../backend`
with its `.env` configured), then open the UI. Login/register work against the
real backend; pages show friendly empty/error states when data isn't available.

## What's inside

| Section | Route | Features |
|---|---|---|
| Home | `/` | Hero, whole-site language picker (8 languages), features, register CTA |
| Auth | `/login`, `/register`, `/admin/login` | Farmer + admin login, registration with username availability check |
| Onboarding | `/onboarding` | 7-step profile setup: language, soil, farm size, crops, irrigation, main problem, GPS/manual location |
| Dashboard | `/dashboard` | Live weather widget, mandi prices for your crops, quick tools |
| Weather | `/weather` | Current conditions, 6 stats, 5-day forecast, translated alert codes, soil-moisture advice |
| Market | `/market` | "My Crops" prices (from your profile) + browse all mandi prices by state/commodity |
| Crop Tools | `/crop-tools` | AI crop recommendation, fertilizer suggestion (with NPK deficit), yield prediction (per unit group) |
| Vision | `/vision` | Disease detection from leaf photo, soil classification from photo, disease history |
| AI Chat | `/chat` | Agentic WebSocket chat, voice input (transcribe), read-aloud (TTS), photo analysis inline |
| News | `/news` | Farming news, pest alerts, scheme news, verified scheme announcements |
| Profile | `/profile` | Edit farm details, detect soil type from a photo, logout |
| Admin | `/admin` | Analytics, farmer list, announcements CRUD, market CSV upload + AGMARKNET sync |
| 404 | `*` | Friendly not-found page |

## Translation

The whole site (all pages, nav, buttons, alerts, even backend alert codes) is
translatable via `src/i18n` — 8 languages (English, हिन्दी, తెలుగు, தமிழ்,
ಕನ್ನಡ, मराठी, বাংলা, ਪੰਜਾਬੀ), 551 keys each, kept in sync.

- Switch language from the Home page picker or the accessibility bar
  (Languages button) on every page.
- Your choice persists in `localStorage`; the farmer's saved chat language is
  applied automatically at login.
- Add/translate keys in `src/i18n/locales/*.json`, then run
  `node scripts/sync_i18n.py` (or `python3 scripts/sync_i18n.py`) to keep all
  8 files in sync.

## Accessibility

The accessibility bar (on every logged-in page) offers:
- **Aa** — large-text mode
- **🔊** — speech mode: hover/click any element to hear it read aloud
- **🌐** — language switcher

## Notes

- All API calls go through the Vite dev proxy (`/api` → `http://localhost:8000`,
  `/ws` → `ws://localhost:8000`), so no CORS issues in development and the
  same-origin WebSocket works in the hosted preview too.
- Voice input needs a browser with `MediaRecorder`; TTS uses the backend's
  edge-tts endpoint (`/chat/speak`).
