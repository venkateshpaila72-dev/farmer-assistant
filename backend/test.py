""" import asyncio
from app.utils.whatsapp_utils import send_whatsapp_message

async def test():
    result = await send_whatsapp_message("7386587706", "Test message from Farmer Assistant")
    print(result)

asyncio.run(test()) """




""" import httpx

url = "https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24"
params = {
    "api-key": "579b464db66ec23bdd000001061e64252b214c6e4e2933d8cb8e5589",
    "format": "json",
    "limit": 1
}

transport = httpx.HTTPTransport(local_address="0.0.0.0")

try:
    with httpx.Client(transport=transport, timeout=10, verify=False, trust_env=False) as client:
        response = client.get(url, params=params)
        print("Status:", response.status_code)
        print(response.json())
except httpx.TimeoutException:
    print("❌ STILL TIMED OUT")
except Exception as e:
    print("❌ ERROR:", type(e).__name__, str(e)) """
    
    
import subprocess
import json

def fetch_via_curl(url: str, params: dict, timeout: int = 20) -> dict:
    query = "&".join(f"{k}={v}" for k, v in params.items())
    full_url = f"{url}?{query}"

    result = subprocess.run(
        ["curl.exe", "-4", "-s", "--max-time", str(timeout), full_url],
        capture_output=True,
        text=True,
        timeout=timeout + 5
    )
    if result.returncode != 0:
        raise RuntimeError(f"curl failed (code {result.returncode}): {result.stderr}")
    return json.loads(result.stdout)


url = "https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24"
params = {
    "api-key": "579b464db66ec23bdd000001061e64252b214c6e4e2933d8cb8e5589",
    "format": "json",
    "limit": 1
}

try:
    data = fetch_via_curl(url, params)
    print("✅ Got data:", data["count"], "record(s)")
    print(data["records"])
except Exception as e:
    print("❌ ERROR:", type(e).__name__, str(e))