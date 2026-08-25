# Farmer Assistant — Backend

FastAPI backend for the Farmer Assistant platform: auth, live data integrations, ML inference, RAG-powered chat, and a daily scheduled agent.

## Tech stack

- **Framework:** FastAPI (async), Uvicorn
- **Database:** MongoDB via Motor (async driver)
- **Auth:** JWT (`python-jose`) + bcrypt password hashing (`passlib`)
- **LLM:** Groq (Llama 3.3 70B), with automatic key rotation across up to 4 keys on rate limits
- **Agentic chat:** LangGraph (ReAct-style tool-calling agent) + LangChain core
- **RAG:** Pinecone (hosted embeddings, `llama-text-embed-v2`) over ingested ICAR farming documents
- **ML models:** scikit-learn / XGBoost (crop, fertilizer, yield) and TensorFlow/MobileNetV2 (soil classification, disease detection) — pretrained models shipped in `saved_models/`
- **Media:** Cloudinary (image uploads), `edge-tts` (text-to-speech for chat replies)
- **Scheduling:** APScheduler (in-process) + an authenticated `/cron` fallback route for hosts that sleep when idle (Render/Railway free tier)
- **Messaging:** Twilio WhatsApp (daily farm reports)

## Setup

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then fill in the values below
uvicorn app.main:app --reload
```

API docs (Swagger UI) are available at `http://localhost:8000/docs` once running.

## Environment variables

All required keys, grouped by service (see `app/core/config.py` for the full list with defaults):

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URL` | ✅ | MongoDB connection string |
| `DB_NAME` | – | defaults to `farmer_assistant` |
| `JWT_SECRET_KEY` | ✅ | sign/verify tokens |
| `JWT_EXPIRE_MINUTES` | – | defaults to 5 days |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | ✅ | image uploads |
| `GROQ_API_KEY` (+ `_2`, `_3`, `_4`) | ✅ (extras optional) | LLM calls, rotates on rate limit |
| `NVIDIA_API_KEY` | ✅ | embeddings |
| `PINECONE_API_KEY` | ✅ | RAG vector store |
| `GNEWS_API_KEY`, `NEWSDATA_API_KEY` | ✅ | farming news (primary tiers) |
| `CURRENTS_API_KEY` | optional | low-priority news fallback |
| `AGMARKNET_API_KEY` | ✅ | market prices (data.gov.in) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | ✅ | WhatsApp daily reports |
| `CRON_SECRET` | optional (required in prod) | protects the `/cron/*` endpoints |
| `FRONTEND_URL` | – | used for reference; CORS is currently open — see note below |

> ⚠️ `MAX_UPLOAD_SIZE_MB` is referenced in `routes/upload.py` but is **not** currently declared in `Settings` — add it to `config.py` (and `.env`) before relying on file uploads, or every call to `/upload/file` will 500.

## Project structure

```
app/
├── main.py            → FastAPI app, router registration, CORS, lifespan (DB connect, indexes, scheduler)
├── core/               → settings (config.py) and auth/JWT helpers (security.py)
├── db/                 → Motor connection, collection names, index creation, Pydantic schemas
├── routes/             → one file per resource — auth, users, admin, onboarding, location,
│                          weather, market, news, ds, upload, ml, vision, ai, rag, ws, agent, cron
├── ml_models/           → inference wrappers around the pretrained crop/fertilizer/yield/soil/disease models
├── agents/              → per-domain agent logic (weather, market, soil, disease) + supervisor
├── rag/                 → Pinecone client, document ingestion, LangChain retriever
├── utils/               → Groq client + key rotation, news aggregation, weather, market, chat
│                          history, memory extraction, scheduler jobs, TTS, WhatsApp, etc.
└── saved_models/        → pretrained model artifacts (.pkl / .h5), loaded relative to this folder
```

## Key architectural notes

- **Phased routers** — routes are grouped by the project phase they were built in (see the comments in `main.py`); each phase's routers are registered together.
- **WebSocket chat auth** — browsers can't send custom headers on a WS handshake, so the JWT is passed as a query param (`/ws/chat/{username}?token=...`) and verified against the URL's username *before* the connection is accepted.
- **Groq key rotation** — if the primary `GROQ_API_KEY` hits its daily rate limit, requests automatically roll over to `GROQ_API_KEY_2/3/4` if configured.
- **News aggregation** is tiered: GNews + NewsData run in parallel as primary sources, with curated RSS, Google News RSS, and finally Currents API as progressively lower-priority fallbacks.
- **Cron fallback** — `/cron/run-daily-jobs` (and the split `/cron/run-market-sync`, `/cron/run-reports`) let an external scheduler (cron-job.org, GitHub Actions, etc.) trigger the daily jobs on hosts where the process sleeps when idle. Protected by a shared secret header (`X-Cron-Secret`), not the admin JWT flow.

## Running the ML/RAG pieces

- Pretrained models are already in `saved_models/` — no training step needed to run the API.
- RAG requires a populated Pinecone index (`PINECONE_INDEX_NAME`, namespace `farming-docs`) — see `app/rag/ingest.py` to (re)ingest ICAR documents.

## Known gaps

- No `requirements.txt` version pins (all packages are unpinned) — consider freezing versions before deploying.
- CORS is currently `allow_origin_regex=".*"` — restrict to your real frontend origin(s) before production.
- No automated tests.