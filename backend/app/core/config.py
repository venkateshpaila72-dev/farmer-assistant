from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ============================================================
    # MongoDB
    # ============================================================
    MONGODB_URL: str
    DB_NAME: str = "farmer_assistant"

    # ============================================================
    # JWT
    # ============================================================
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 5 * 24 * 60

    # ============================================================
    # Cloudinary
    # ============================================================
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str

    # ============================================================
    # Groq
    # ============================================================
    GROQ_API_KEY: str
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    GROQ_API_KEY_2: Optional[str] = None
    GROQ_API_KEY_3: Optional[str] = None
    GROQ_API_KEY_4: Optional[str] = None

    # ============================================================
    # NVIDIA NIM — Embeddings
    # ============================================================
    NVIDIA_API_KEY: str
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_EMBED_MODEL: str = "nvidia/nv-embedqa-e5-v5"

    # ============================================================
    # Pinecone — RAG
    # ============================================================
    PINECONE_API_KEY: str
    PINECONE_INDEX_NAME: str = "farmer-assistant"
    PINECONE_ENVIRONMENT: str = "us-east-1"

    # ============================================================
    # GNews
    # ============================================================
    GNEWS_API_KEY: str
    GNEWS_BASE_URL: str = "https://gnews.io/api/v4"

    # ============================================================
    # NewsData.io
    # ============================================================
    NEWSDATA_API_KEY: str
    NEWSDATA_BASE_URL: str = "https://newsdata.io/api/1"

    # ============================================================
    # Currents API — optional
    # ============================================================
    CURRENTS_API_KEY: Optional[str] = None
    CURRENTS_BASE_URL: str = "https://api.currentsapi.services/v1"

    # ============================================================
    # AGMARKNET 2.0
    #
    # IMPORTANT:
    # Do NOT keep the old AGMARKNET_API_KEY / AGMARKNET_API_URL
    # settings here.
    # ============================================================
    AGMARKNET_BASE_URL: str = "https://api.agmarknet.gov.in/v1"

    # ============================================================
    # Azure AI Translator
    # ============================================================
    AZURE_TRANSLATOR_KEY: Optional[str] = None

    AZURE_TRANSLATOR_REGION: Optional[str] = None

    AZURE_TRANSLATOR_ENDPOINT: str = (
        "https://api.cognitive.microsofttranslator.com"
    )

    TRANSLATION_MAX_CHARS: int = 1500

    # ============================================================
    # Open-Meteo
    # ============================================================
    OPEN_METEO_BASE_URL: str = (
        "https://api.open-meteo.com/v1/forecast"
    )

    # ============================================================
    # IP API
    # ============================================================
    IP_API_BASE_URL: str = "http://ip-api.com/json"

    # ============================================================
    # Twilio WhatsApp
    # ============================================================
    TWILIO_ACCOUNT_SID: str
    TWILIO_AUTH_TOKEN: str

    TWILIO_WHATSAPP_FROM: str = (
        "whatsapp:+14155238886"
    )

    # ============================================================
    # Application
    # ============================================================
    APP_NAME: str = "Farmer Assistant"

    DEBUG: bool = True

    FRONTEND_URL: str = "http://localhost:5173"

    # ============================================================
    # Uploads
    # ============================================================
    MAX_UPLOAD_SIZE_MB: int = 10

    # ============================================================
    # Agent Scheduler
    # ============================================================
    AGENT_SCHEDULE_HOUR: int = 6
    AGENT_SCHEDULE_MINUTE: int = 0

    # ============================================================
    # External Cron
    # ============================================================
    CRON_SECRET: Optional[str] = None

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()