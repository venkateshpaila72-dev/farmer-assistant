import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()
KEY = os.getenv("NEWSDATA_API_KEY")
if not KEY:
    sys.exit("NEWSDATA_API_KEY not found in .env")

BASE = "https://newsdata.io/api/1"

TESTS = [
    # (label, endpoint, params)
    ("1. Your Query Builder URL (title 'FARMERS', 5 categories)", "latest", {
        "qInTitle": "FARMERS", "country": "in",
        "language": "te,hi,en",
        "category": "breaking,business,lifestyle,top,science",
    }),
    ("2. Farming keywords, India, English", "latest", {
        "q": "farmer OR agriculture OR crop", "country": "in", "language": "en",
    }),
    ("3. Farming keywords, India, Hindi + Telugu", "latest", {
        "q": "farmer OR agriculture OR crop", "country": "in", "language": "hi,te",
    }),
    ("4. What the current backend does: OLD /news endpoint", "news", {
        "q": "India farming crop agriculture", "language": "en", "country": "in",
    }),
]

for label, endpoint, params in TESTS:
    print(f"\n=== {label} ===")
    try:
        r = requests.get(f"{BASE}/{endpoint}", params={"apikey": KEY, **params}, timeout=30)
    except requests.RequestException as e:
        print("CONNECTION FAILED:", e)
        continue

    print("HTTP status:", r.status_code)
    try:
        data = r.json()
    except ValueError:
        print("Not JSON:", r.text[:200])
        continue

    status = data.get("status")
    print("API status:", status, "| totalResults:", data.get("totalResults"))
    articles = data.get("results", []) or []
    with_img = [a for a in articles if a.get("image_url")]
    print(f"Articles returned: {len(articles)} | with image: {len(with_img)}")
    for a in articles[:5]:
        print("  -", a.get("title"))
        print("     image:", a.get("image_url"))
    if status != "success":
        # NewsData puts the real reason in results.message / results.code
        print("Error detail:", data.get("results"))
        continue

    articles = data.get("results", []) or []
    print("Articles returned:", len(articles))
    for a in articles[:3]:
        print("  -", a.get("title"))
        print("    ", a.get("source_id"), "|", a.get("pubDate"), "|", a.get("link"))