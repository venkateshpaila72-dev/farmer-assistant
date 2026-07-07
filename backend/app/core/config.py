from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URL: str
    DB_NAME: str = "farmer_assistant"

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str

    # Groq — Primary LLM
    GROQ_API_KEY: str
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Groq — Fallback keys for rotation when primary hits its daily rate limit.
    # All optional — if not set in .env, rotation simply has fewer keys to use.
    GROQ_API_KEY_2: Optional[str] = None
    GROQ_API_KEY_3: Optional[str] = None
    GROQ_API_KEY_4: Optional[str] = None

    # NVIDIA NIM — Embeddings
    NVIDIA_API_KEY: str
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_EMBED_MODEL: str = "nvidia/nv-embedqa-e5-v5"

    # Pinecone — RAG Vector DB
    PINECONE_API_KEY: str
    PINECONE_INDEX_NAME: str = "farmer-assistant"
    PINECONE_ENVIRONMENT: str = "us-east-1"

    # GNews — Farming News
    GNEWS_API_KEY: str
    GNEWS_BASE_URL: str = "https://gnews.io/api/v4"

    # AGMARKNET — Live Market Prices (data.gov.in)
    AGMARKNET_API_KEY: str
    AGMARKNET_API_URL: str = "https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24"

    # Open-Meteo — No key needed
    OPEN_METEO_BASE_URL: str = "https://api.open-meteo.com/v1/forecast"

    # IP API — No key needed
    IP_API_BASE_URL: str = "http://ip-api.com/json"

    # Twilio WhatsApp
    TWILIO_ACCOUNT_SID: str
    TWILIO_AUTH_TOKEN: str
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"

    # App Settings
    APP_NAME: str = "Farmer Assistant"
    DEBUG: bool = True
    FRONTEND_URL: str = "http://localhost:5173"

    # Agent Scheduler — daily farm report at 6 AM
    AGENT_SCHEDULE_HOUR: int = 6
    AGENT_SCHEDULE_MINUTE: int = 0

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()