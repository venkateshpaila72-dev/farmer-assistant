import ssl
import asyncio
import httpx
from datetime import datetime
from app.core.config import settings


def _legacy_tolerant_ssl_context() -> ssl.SSLContext:
    """
    Some networks (often antivirus "HTTPS scanning" or a corporate SSL-
    inspecting firewall/proxy) transparently intercept TLS connections and
    require a legacy renegotiation mid-handshake. Windows' native schannel
    (what curl.exe uses) tolerates this; Python's OpenSSL-based ssl module
    does not by default since OpenSSL 3.x disables legacy renegotiation for
    security reasons — the connection just hangs until timeout instead of
    failing cleanly.

    This re-enables it for outbound requests only (0x4 == the numeric value
    of SSL_OP_LEGACY_SERVER_CONNECT — not yet exposed as a named ssl.*
    constant before Python 3.12).
    """
    ctx = ssl.create_default_context()
    ctx.options |= 0x4
    return ctx


_ssl_context = _legacy_tolerant_ssl_context()


async def get_current_weather(lat: float, lng: float) -> dict:
    """
    Fetch current weather + 5 day forecast from Open-Meteo.
    No API key needed — completely free.

    Retries once on connection timeout — some intercepting network devices
    (see _legacy_tolerant_ssl_context above) add extra TLS round-trips that
    occasionally exceed even a generous timeout; a single retry catches most
    of these transient failures without meaningfully slowing down the
    common case where the first attempt just works.
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

    last_error = None
    for attempt in range(2):
        try:
            # local_address="0.0.0.0" forces an IPv4 local socket, which in
            # turn makes the connection attempt only viable against IPv4
            # remote addresses — sidesteps a separate failure mode where a
            # newly-available NAT64-synthesized IPv6 route gets tried first
            # and hangs, even though a fast working IPv4 path exists
            # alongside it (confirmed via curl showing both routes present).
            transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0")
            async with httpx.AsyncClient(timeout=20, verify=_ssl_context, transport=transport) as client:
                response = await client.get(settings.OPEN_METEO_BASE_URL, params=params)
                response.raise_for_status()
                data = response.json()
                break
        except httpx.ConnectTimeout as e:
            last_error = e
            if attempt == 0:
                await asyncio.sleep(1)
                continue
            raise

    current = data.get("current", {})
    daily   = data.get("daily", {})
    hourly  = data.get("hourly", {})

    # Detect farming alerts — return type codes, not pre-formatted English
    # text, so the frontend can translate each one via i18n instead of
    # always showing English regardless of the farmer's selected language.
    alerts = []
    temp     = current.get("temperature_2m", 0)
    rain     = current.get("precipitation", 0)
    humidity = current.get("relative_humidity_2m", 0)

    if temp > 40:
        alerts.append("extreme_heat")
    if temp < 5:
        alerts.append("frost_risk")
    if rain > 50:
        alerts.append("heavy_rainfall")
    if humidity > 85:
        alerts.append("high_humidity")

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