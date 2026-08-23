from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from groq import Groq
from app.core.config import settings
from app.db.database import get_db
from app.db.models import FARMER_PROFILES_COLLECTION, MARKET_PRICES_COLLECTION
from app.utils.weather_utils import get_current_weather, get_season_from_month
from app.core.security import get_current_user

router = APIRouter()

# Initialize Groq client
groq_client = Groq(api_key=settings.GROQ_API_KEY)


def call_groq(prompt: str, system: str = None, max_tokens: int = 500) -> str:
    """Call Groq API and return response text."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = groq_client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=messages,
        max_tokens=max_tokens
    )
    return response.choices[0].message.content.strip()


# ── Trending Crops (Landing Page) ─────────────────────────────────────────────

@router.get("/suggest-trending")
async def suggest_trending(state: str = None):
    """
    Get trending crops to show on landing page.
    Uses Groq to generate context-aware suggestions based on season.
    """
    season = get_season_from_month(datetime.now().month)
    month  = datetime.now().strftime("%B")

    prompt = f"""You are an expert Indian agricultural advisor.
Current month: {month}
Current season: {season}
State: {state or 'India (general)'}

List exactly 5 trending crops that Indian farmers should consider growing this {season} season.
For each crop give: name, reason (1 line), and expected price range in Rs/quintal.

Format as JSON array:
[{{"crop": "Rice", "reason": "High demand, good rainfall season", "price_range": "1800-2200"}}]

Return only valid JSON, no extra text."""

    try:
        response = call_groq(prompt, max_tokens=400)
        import json
        # Clean response and parse
        response = response.strip()
        if response.startswith("```"):
            response = response.split("```")[1]
            if response.startswith("json"):
                response = response[4:]
        trending = json.loads(response)
    except Exception:
        # Fallback if JSON parsing fails
        trending = [
            {"crop": "Rice",   "reason": "Kharif season staple",       "price_range": "1800-2200"},
            {"crop": "Tomato", "reason": "High market demand",          "price_range": "800-2000"},
            {"crop": "Maize",  "reason": "Good rainfall utilization",   "price_range": "1400-1800"},
            {"crop": "Cotton", "reason": "Strong export demand",        "price_range": "6000-7500"},
            {"crop": "Onion",  "reason": "Year-round high consumption", "price_range": "1000-3000"},
        ]

    return {
        "season":       season,
        "month":        month,
        "state":        state or "India",
        "trending":     trending
    }


# ── State-wise Crop Advisory ──────────────────────────────────────────────────

@router.get("/advisory/{username}")
async def get_crop_advisory(username: str, current_user: dict = Depends(get_current_user)):
    """
    Generate personalized state-wise crop advisory for farmer.
    Combines live weather + soil + season + farmer profile → Groq advisory.
    """
    if current_user["role"] != "admin" and current_user["username"] != username:
        raise HTTPException(status_code=403, detail="Not your account")

    db = get_db()

    profile = await db[FARMER_PROFILES_COLLECTION].find_one({"username": username})
    if not profile:
        raise HTTPException(status_code=404, detail="Farmer profile not found")

    location = profile.get("current_location", profile.get("home_location", {}))
    state    = location.get("state", "India")
    district = location.get("district", "")
    soil     = profile.get("soil_type", "loamy")
    crops    = profile.get("preferred_crops", [])
    acres    = profile.get("farm_acres", 1)
    season   = get_season_from_month(datetime.now().month)
    month    = datetime.now().strftime("%B")

    # Get live weather
    try:
        weather = await get_current_weather(
            lat=location.get("lat", 17.97),
            lng=location.get("lng", 79.59)
        )
        current  = weather.get("current", {})
        temp     = current.get("temperature", 28)
        humidity = current.get("humidity", 65)
        alerts   = weather.get("alerts", [])
    except Exception:
        temp     = 28
        humidity = 65
        alerts   = []

    prompt = f"""You are an expert Indian agricultural advisor helping a farmer in {state}.

FARMER PROFILE:
- Location: {district}, {state}
- Soil type: {soil}
- Farm size: {acres} acres
- Current crops: {', '.join(crops) if crops else 'not specified'}
- Season: {season} ({month})

CURRENT CONDITIONS:
- Temperature: {temp}°C
- Humidity: {humidity}%
- Weather alerts: {', '.join(alerts) if alerts else 'none'}

Provide a concise farming advisory covering:
1. Best crops to grow this season in {state}
2. Key farming actions for this month
3. Any warnings based on current weather
4. One important tip for {soil} soil

Keep it practical, specific to {state}, and under 200 words."""

    try:
        advisory = call_groq(
            prompt,
            system="You are a helpful Indian farming expert. Give practical, specific advice.",
            max_tokens=400
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Advisory generation failed: {str(e)}")

    return {
        "username":    username,
        "state":       state,
        "district":    district,
        "season":      season,
        "soil_type":   soil,
        "temperature": temp,
        "humidity":    humidity,
        "alerts":      alerts,
        "advisory":    advisory
    }


# ── General Farming Advice ────────────────────────────────────────────────────

@router.post("/advice")
async def get_farming_advice(question: str, current_user: dict = Depends(get_current_user)):
    """
    Answer any farming question using Groq.
    Uses the authenticated user's profile as context.
    """
    username = current_user["username"]
    context = ""

    if username:
        db      = get_db()
        profile = await db[FARMER_PROFILES_COLLECTION].find_one({"username": username})
        if profile:
            location = profile.get("current_location", {})
            context  = f"""
Farmer context:
- State: {location.get('state', 'India')}
- Soil: {profile.get('soil_type', 'unknown')}
- Crops: {', '.join(profile.get('preferred_crops', []))}
- Farm size: {profile.get('farm_acres', 1)} acres
"""

    prompt = f"{context}\nFarming question: {question}"

    try:
        answer = call_groq(
            prompt,
            system="You are an expert Indian agricultural advisor. Give practical, accurate farming advice in simple language.",
            max_tokens=500
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get advice: {str(e)}")

    return {
        "question": question,
        "answer":   answer,
        "username": username
    }