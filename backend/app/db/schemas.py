from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime

def validate_password_length(v: str) -> str:
    if len(v.encode("utf-8")) > 72:
        raise ValueError("Password cannot be longer than 72 bytes")
    return v


# ── AUTH ──────────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


# ── FARMER ───────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    username: str
    password: str
    phone: str
    door_no: str
    village: str
    city: str
    state: str

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return validate_password_length(v)


class UserLogin(BaseModel):
    username: str
    password: str

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return validate_password_length(v)


class UserResponse(BaseModel):
    username: str
    phone: str
    village: str
    city: str
    state: str
    role: str = "user"
    created_at: Optional[datetime] = None


class UpdateFarmerPhone(BaseModel):
    phone: str


# ── ADMIN ─────────────────────────────────────────────────────────────────────

class AdminRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    admin_secret: str  # must match ADMIN_SIGNUP_SECRET env var

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return validate_password_length(v)


class AdminLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return validate_password_length(v)


class AdminResponse(BaseModel):
    name: str
    email: str
    role: str = "admin"


# ── ONBOARDING ────────────────────────────────────────────────────────────────

class LocationData(BaseModel):
    state: str
    district: str
    village: str
    lat: float
    lng: float


class OnboardingData(BaseModel):
    username: str
    soil_type: str
    soil_image_url: Optional[str] = None
    farm_acres: float
    preferred_crops: List[str]
    irrigation_type: str          # rainfall / canal / borewell
    main_problem: str             # pests / water / price / disease
    chat_language: str = "English"
    home_location: LocationData


class OnboardingResponse(BaseModel):
    message: str
    username: str
    onboarding_complete: bool = True


# ── LOCATION ──────────────────────────────────────────────────────────────────

class LocationCheckRequest(BaseModel):
    username: str
    current_lat: float
    current_lng: float


class LocationUpdateRequest(BaseModel):
    username: str
    new_lat: float
    new_lng: float
    new_state: str
    new_district: str
    is_temporary: bool = False


# ── MARKET PRICES (admin uploads CSV dataset) ─────────────────────────────────

class MarketPriceUpload(BaseModel):
    uploaded_by: str
    week_start: str               # e.g. "2026-06-16"
    week_end: str                 # e.g. "2026-06-22"
    record_count: int


# ── CHAT ──────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    username: str
    message: str
    language: Optional[str] = "English"


class ChatResponse(BaseModel):
    response: str
    sources: Optional[List[str]] = []


# ── ML — CROP RECOMMENDATION ─────────────────────────────────────────────────

class CropRecommendRequest(BaseModel):
    username: str
    # All fields below are auto-loaded from farmer profile + live weather
    # Frontend only sends username — backend fills the rest
    N: Optional[float] = None
    P: Optional[float] = None
    K: Optional[float] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    ph: Optional[float] = None
    rainfall: Optional[float] = None
    # Optional soil type override — used to preview a recommendation for a
    # freshly-detected soil photo result without writing it to the profile.
    # Accepts either an onboarding-style value ("black", "loamy") or a raw
    # soil-image classifier output ("Black Soil") — both resolve through
    # resolve_soil_nutrients() in the route.
    soil_type: Optional[str] = None


class CropRecommendResponse(BaseModel):
    top_crops: List[dict]         # [{"crop": "Rice", "confidence": 94.2}, ...]
    season: str
    location: str
    soil_type: str
    shap_explanation: Optional[str] = None


# ── ML — FERTILIZER ───────────────────────────────────────────────────────────

class FertilizerRecommendRequest(BaseModel):
    username: str
    crop_type: str                # farmer selects crop from dropdown


class FertilizerRecommendResponse(BaseModel):
    fertilizer: str
    confidence: float
    dosage: str
    method: str


# ── ML — YIELD PREDICTION ─────────────────────────────────────────────────────

class YieldPredictRequest(BaseModel):
    username: str
    crop: str
    season: str
    year: int
    area_hectares: float
    rainfall: Optional[float] = None


class YieldPredictResponse(BaseModel):
    crop: str
    area_hectares: float
    yield_per_hectare: float
    total_yield_quintals: float
    unit: str = "quintals"


# ── VISION — DISEASE DETECTION ────────────────────────────────────────────────

class DiseaseDetectionResponse(BaseModel):
    disease: str
    severity: str
    confidence: float
    treatment: str
    prevention: str
    image_url: str


# ── VISION — SOIL CLASSIFICATION ─────────────────────────────────────────────

class SoilClassificationResponse(BaseModel):
    soil_type: str
    confidence: float
    image_url: str
    all_probabilities: dict


# ── AGENT — DAILY FARM REPORT ─────────────────────────────────────────────────

class FarmReportResponse(BaseModel):
    username: str
    date: str
    soil_report: dict
    weather_report: dict
    disease_report: dict
    market_report: dict
    unified_summary: str
    language: str
    whatsapp_sent: bool


# ── ADMIN — ANNOUNCEMENT ──────────────────────────────────────────────────────

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    posted_by: str
    # Structured scheme-card fields — all optional so a plain general
    # announcement (not a govt scheme) still works with just title/content.
    benefit: str = ""          # e.g. "₹6,000/year in 3 installments"
    eligibility: str = ""      # e.g. "Land-owning farmer families"
    where_to_apply: str = ""   # e.g. "Nearest Common Service Centre / Rythu Seva Kendram"
    official_link: str = ""    # e.g. "https://pmkisan.gov.in"
    status: str = "active"     # "active" | "discontinued" — lets old/replaced
                                # schemes stay visible (e.g. "replaced by X")
                                # instead of just being deleted and forgotten


class MarketPriceCreate(BaseModel):
    state: str
    district: str
    market: str
    commodity: str
    variety: str = ""
    grade: str = ""
    commodity_code: str = ""
    min_price: float = 0
    max_price: float = 0
    modal_price: float = 0
    arrival_date: str


# ── GENERIC ───────────────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
    success: bool = True