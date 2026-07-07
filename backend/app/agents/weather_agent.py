"""
Weather Agent — deterministic, no Groq calls.

Scans the FULL day's forecast ahead (not just the current snapshot) so a
6 AM check can catch danger expected later today, not just right now.

Two threshold tiers:
- "notable"   -> goes in the calm daily report
- "dangerous" -> triggers a separate urgent alert message

NOTABLE thresholds:
- Rainfall > 50mm in the day  -> heavy rain risk
- Temperature > 40C            -> heat stress risk
- Humidity > 80%               -> fungal disease risk

DANGEROUS thresholds (alert-level):
- Rainfall > 100mm in the day -> flood-level risk
- Temperature > 45C            -> extreme heat danger
"""

from app.utils.weather_utils import get_current_weather

# Notable — daily report tier
RAINFALL_NOTABLE_MM    = 50
TEMP_NOTABLE_C          = 40
HUMIDITY_NOTABLE_PCT    = 80

# Dangerous — alert tier (stricter, only genuinely severe conditions)
RAINFALL_DANGEROUS_MM   = 100
TEMP_DANGEROUS_C        = 45


async def check_weather(lat: float, lng: float) -> dict:
    """
    Run weather risk checks for a single farmer's location, scanning the
    full day ahead rather than just the current moment. Findings are
    tagged with tier='notable' or tier='dangerous' so the Supervisor can
    route them into the daily report and/or a separate alert.
    """
    try:
        weather = await get_current_weather(lat=lat, lng=lng)
    except Exception as e:
        return {
            "agent":        "weather",
            "risk_found":   False,
            "danger_found": False,
            "error":        str(e)
        }

    current  = weather.get("current", {})
    forecast = weather.get("forecast", [])

    temperature = current.get("temperature")
    humidity    = current.get("humidity")

    # Scan today's forecast entry — take max rainfall and max temp so
    # danger expected later today is still caught at the 6 AM check.
    today_entries = forecast[:1] if forecast else []  # forecast[0] = today
    max_rainfall_today = 0
    max_temp_today      = temperature if temperature is not None else 0

    for entry in today_entries:
        precip = entry.get("precipitation", 0) or 0
        if precip > max_rainfall_today:
            max_rainfall_today = precip
        temp_max = entry.get("temp_max")
        if temp_max is not None and temp_max > max_temp_today:
            max_temp_today = temp_max

    findings = []

    # Rainfall checks
    if max_rainfall_today > RAINFALL_DANGEROUS_MM:
        findings.append({
            "type": "flood_risk", "tier": "dangerous", "severity": "high",
            "detail": f"{max_rainfall_today}mm rainfall expected today — flood-level risk, threshold {RAINFALL_DANGEROUS_MM}mm"
        })
    elif max_rainfall_today > RAINFALL_NOTABLE_MM:
        findings.append({
            "type": "heavy_rain", "tier": "notable", "severity": "medium",
            "detail": f"{max_rainfall_today}mm rainfall expected today (threshold {RAINFALL_NOTABLE_MM}mm)"
        })

    # Temperature checks
    if max_temp_today > TEMP_DANGEROUS_C:
        findings.append({
            "type": "extreme_heat", "tier": "dangerous", "severity": "high",
            "detail": f"Temperature expected to reach {max_temp_today}°C — extreme heat danger, threshold {TEMP_DANGEROUS_C}°C"
        })
    elif max_temp_today > TEMP_NOTABLE_C:
        findings.append({
            "type": "heat_stress", "tier": "notable", "severity": "medium",
            "detail": f"Temperature expected to reach {max_temp_today}°C (threshold {TEMP_NOTABLE_C}°C)"
        })

    # Humidity — notable only, not a "dangerous" tier condition
    if humidity is not None and humidity > HUMIDITY_NOTABLE_PCT:
        findings.append({
            "type": "fungal_disease_risk", "tier": "notable", "severity": "medium",
            "detail": f"Humidity at {humidity}% (threshold {HUMIDITY_NOTABLE_PCT}%) — favorable for fungal disease"
        })

    # Surface any alerts the weather API itself already flags — treated as notable
    for alert in weather.get("alerts", []):
        findings.append({
            "type": "weather_api_alert", "tier": "notable", "severity": "medium",
            "detail": alert
        })

    danger_findings  = [f for f in findings if f["tier"] == "dangerous"]
    notable_findings = [f for f in findings if f["tier"] == "notable"]

    return {
        "agent":           "weather",
        "risk_found":      len(notable_findings) > 0,
        "danger_found":    len(danger_findings) > 0,
        "findings":        notable_findings,
        "danger_findings": danger_findings,
        "raw": {
            "temperature":        temperature,
            "humidity":           humidity,
            "max_rainfall_today": max_rainfall_today,
            "max_temp_today":     max_temp_today
        }
    }