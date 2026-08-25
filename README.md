# Khishan Sahayak 🌾

An AI-powered platform that gives Indian farmers a single place to get crop/fertilizer/yield recommendations, soil and disease detection from photos, live weather, market prices, farming news, and a multilingual conversational assistant — via a WebSocket chatbot backed by RAG over ICAR documents.

Built as a student project across six phases: auth & onboarding, live data integrations, ML models, RAG + chat, and a daily agent that sends farmers a WhatsApp report.

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI, Motor (async MongoDB), Pydantic |
| Frontend | React 19, Vite, Tailwind CSS |
| Database | MongoDB |
| ML | scikit-learn, XGBoost, TensorFlow (MobileNetV2) |
| LLM | Groq (Llama 3.3 70B), LangChain, LangGraph |
| Vector DB | Pinecone (RAG over ICAR farming documents) |
| Media | Cloudinary (image storage), edge-tts (voice replies) |
| Messaging | Twilio WhatsApp (daily farm reports) |
| Auth | JWT (python-jose) + bcrypt (passlib) |

## Project structure

```
farmer-assistant/
├── backend/     → FastAPI API, ML models, RAG pipeline, agents (see backend/README.md)
├── frontend/    → React + Vite web app (see frontend/README.md)
└── CHANGES.md   → notes on recent UI/animation changes
```

## Quick start

You'll need both the backend and frontend running at once.

```bash
# 1. Backend
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # fill in your API keys — see backend/README.md
uvicorn app.main:app --reload

# 2. Frontend (in a second terminal)
cd frontend
npm install
cp .env.example .env
npm run dev
```

- Backend runs at `https://kishan-sahayak-gdpl.onrender.com` (interactive docs at `/docs`)
- Frontend runs at `https://farmer-assistant-theta.vercel.app/`

See `backend/README.md` and `frontend/README.md` for full setup, environment variables, and architecture details of each side.

## Core features

- 🔐 **Auth & onboarding** — separate farmer/admin login, JWT-protected routes, guided farm-profile onboarding
- 🌦️ **Live data** — weather (Open-Meteo), market prices (AGMARKNET), farming news (GNews/NewsData, multi-tier fallback)
- 🧠 **ML models** — crop recommendation, fertilizer suggestion, yield prediction (XGBoost), soil classification & disease detection from photos (MobileNetV2)
- 💬 **AI chat** — LangGraph tool-calling agent with RAG over ICAR documents, per-farmer memory, multilingual replies, voice input/output
- 📊 **Admin dashboard** — manage farmers, announcements, and platform data
- 📱 **Daily WhatsApp report** — scheduled agent sends each farmer a personalized daily update

## Known limitations

This is a student project, not production-hardened. A few things worth knowing before deploying it anywhere real:
- CORS is currently wide open (`allow_origin_regex=".*"`) — fine for local dev, should be locked to your actual frontend domain before deploying
- JWT is stored in browser `localStorage`
- No automated tests yet

## License

See [LICENSE](./LICENSE).