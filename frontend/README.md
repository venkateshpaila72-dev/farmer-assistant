# Farmer Assistant — Frontend

React + Vite web app for the Farmer Assistant platform: farmer/admin dashboards, onboarding, live chat, crop tools, market and news pages.

## Tech stack

- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS
- **Routing:** React Router v7
- **Forms/validation:** react-hook-form + Zod
- **Animation:** Framer Motion
- **i18n:** i18next / react-i18next (multilingual UI, synced with the farmer's chat language)
- **Charts:** Recharts
- **HTTP:** Axios
- **Markdown rendering:** react-markdown + remark-gfm (for chat replies)
- **Notifications:** react-toastify

## Setup

```bash
npm install
cp .env.example .env      # see variables below
npm run dev
```

Runs at `http://localhost:5173` by default. Requires the backend running (see `../backend/README.md`) at the URL configured below.

## Environment variables

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend REST API, e.g. `http://localhost:8000` |
| `VITE_WS_BASE_URL` | Base URL for the WebSocket chat connection, e.g. `ws://localhost:8000` |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Lint with oxlint |

## Project structure

```
src/
├── api/            → one module per backend resource (auth, users, market, ml, vision, rag, chat...)
├── context/         → AuthContext (session/token), Toast, page transitions, weather background
├── hooks/            → useWebSocket (chat socket), useGeolocation
├── routes/           → ProtectedRoute, AdminRoute, OnboardingGuard — route-level access control
├── layouts/          → PublicLayout, AuthLayout, DashboardLayout, AdminLayout
├── pages/            → public, auth, onboarding, dashboard, chat, crop-tools, market, news,
│                        vision, profile, admin — grouped by feature area
├── components/       → ui primitives, layout pieces, motion wrappers, illustrations, WhatsApp widgets
├── i18n/             → i18next config + locale files (multilingual support)
└── utils/            → formatters, constants, small data caches, label helpers
```

## Key architectural notes

- **Auth** — `AuthContext` holds the logged-in user and JWT (persisted in `localStorage`). On login it also syncs the farmer's saved `chat_language` across the whole site via i18next, not just the chat page.
- **Route guards** — `ProtectedRoute` (must be logged in), `AdminRoute` (must be admin), and `OnboardingGuard` (must have completed the onboarding profile) wrap the relevant route trees.
- **Chat** — `useWebSocket` connects to `/ws/chat/{username}?token=...` (the JWT is passed as a query param since browsers can't set custom headers on a WS handshake). Supports text, voice input (recorded and sent to `/chat/transcribe`), and read-aloud replies (`/chat/speak`).
- **API layer** — every backend resource has a thin wrapper module under `src/api/`; components call these rather than hitting Axios directly, so the base URL and auth header attachment stay in one place (`api/client.js`).

## Known gaps

- JWT is stored in `localStorage`, not an httpOnly cookie — be mindful of XSS exposure if adding third-party scripts later.
- No automated tests yet.