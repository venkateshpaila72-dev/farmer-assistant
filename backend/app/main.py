from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.db.database import connect_db, close_db
from app.db.models import create_indexes

# ── Phase 2 routes ────────────────────────────────────────────────────────────
from app.routes import auth, users, admin, onboarding, location

# ── Phase 3 routes ────────────────────────────────────────────────────────────
from app.routes import weather, market, news, ds, upload

# ── Phase 4 routes ────────────────────────────────────────────────────────────
from app.routes import ml, vision, ai

# ── Phase 5 routes ────────────────────────────────────────────────────────────
from app.routes import rag, ws

# ── Phase 6 routes ────────────────────────────────────────────────────────────
from app.routes import agent
from app.utils.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_db()
    from app.db.database import get_db
    db = get_db()
    await create_indexes(db)
    start_scheduler()
    print(f"✅ {settings.APP_NAME} Backend started!")
    yield
    # Shutdown
    stop_scheduler()
    await close_db()
    print(f"✅ {settings.APP_NAME} Backend stopped!")


app = FastAPI(
    title="Farmer Assistant API",
    description="AI-powered farming assistant for Indian farmers",
    version="1.0.0",
    lifespan=lifespan,
    swagger_ui_parameters={"persistAuthorization": True},
)


# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Phase 2 Routers ───────────────────────────────────────────────────────────
app.include_router(auth.router,       prefix="/auth",       tags=["Auth"])
app.include_router(users.router,      prefix="/users",      tags=["Users"])
app.include_router(admin.router,      prefix="/admins",     tags=["Admin"])
app.include_router(onboarding.router, prefix="/onboarding", tags=["Onboarding"])
app.include_router(location.router,   prefix="/location",   tags=["Location"])

# ── Phase 3 Routers ───────────────────────────────────────────────────────────
app.include_router(weather.router,    prefix="/weather",    tags=["Weather"])
app.include_router(market.router,     prefix="/market",     tags=["Market"])
app.include_router(news.router,       prefix="/news",       tags=["News"])
app.include_router(ds.router,         prefix="/ds",         tags=["Data Science"])
app.include_router(upload.router,     prefix="/upload",     tags=["Upload"])

# ── Phase 4 Routers ───────────────────────────────────────────────────────────
app.include_router(ml.router,         prefix="/ml",         tags=["ML"])
app.include_router(vision.router,     prefix="/vision",     tags=["Vision"])
app.include_router(ai.router,         prefix="/ai",         tags=["AI"])

# ── Phase 5 Routers ───────────────────────────────────────────────────────────
app.include_router(rag.router,        prefix="/rag",        tags=["RAG"])
app.include_router(ws.router,                               tags=["WebSocket"])

# ── Phase 6 Routers ───────────────────────────────────────────────────────────
app.include_router(agent.router,      prefix="/agent",      tags=["Agents"])


@app.get("/", tags=["Health"])
async def root():
    return {
        "message": f"{settings.APP_NAME} API is running!",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}