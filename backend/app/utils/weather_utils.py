import httpx
from datetime import datetime
from app.core.config import settings


async def get_current_weather(lat: float, lng: float) -> dict:
    """
    Fetch current weather + 5 day forecast from Open-Meteo.
    No API key needed — completely free.
    """
    params = {
        "latitude": lat,
        "longitude": lng,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "wind_speed_10m",
            "weather_code"
        ],
        "daily": [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "wind_speed_10m_max",
            "weather_code"
        ],
        "hourly": ["soil_moisture_0_to_1cm"],
        "timezone": "Asia/Kolkata",
        "forecast_days": 5
    }

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(settings.OPEN_METEO_BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()

    current = data.get("current", {})
    daily   = data.get("daily", {})
    hourly  = data.get("hourly", {})

    # Detect farming alerts
    alerts = []
    temp     = current.get("temperature_2m", 0)
    rain     = current.get("precipitation", 0)
    humidity = current.get("relative_humidity_2m", 0)

    if temp > 40:
        alerts.append("⚠️ Extreme heat — water your crops extra today")
    if temp < 5:
        alerts.append("⚠️ Frost risk — protect sensitive crops tonight")
    if rain > 50:
        alerts.append("⚠️ Heavy rainfall — avoid spraying pesticides today")
    if humidity > 85:
        alerts.append("⚠️ High humidity — fungal disease risk is HIGH")

    # Get soil moisture (first available reading)
    soil_moisture = None
    if hourly.get("soil_moisture_0_to_1cm"):
        values = [v for v in hourly["soil_moisture_0_to_1cm"] if v is not None]
        if values:
            soil_moisture = round(values[0], 3)

    return {
        "current": {
            "temperature": current.get("temperature_2m"),
            "humidity":    current.get("relative_humidity_2m"),
            "precipitation": current.get("precipitation"),
            "wind_speed":  current.get("wind_speed_10m"),
            "weather_code": current.get("weather_code")
        },
        "forecast": [
            {
                "date":          daily["time"][i] if daily.get("time") else None,
                "temp_max":      daily["temperature_2m_max"][i] if daily.get("temperature_2m_max") else None,
                "temp_min":      daily["temperature_2m_min"][i] if daily.get("temperature_2m_min") else None,
                "precipitation": daily["precipitation_sum"][i] if daily.get("precipitation_sum") else None,
                "wind_speed":    daily["wind_speed_10m_max"][i] if daily.get("wind_speed_10m_max") else None,
            }
            for i in range(len(daily.get("time", [])))
        ],
        "soil_moisture": soil_moisture,
        "alerts": alerts
    }


def get_season_from_month(month: int) -> str:
    """Return Indian farming season based on current month."""
    if 6 <= month <= 10:
        return "Kharif"
    elif 11 <= month <= 3:
        return "Rabi"
    else:
        return "Zaid"