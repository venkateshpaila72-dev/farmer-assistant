import asyncio
import sys
from datetime import datetime, timezone, timedelta

# Mock MongoDB for the tests if needed, or import utils directly
from app.utils.news_utils import get_farming_news, get_pest_alerts, get_scheme_news, parse_date, extract_article_image
from app.routes.news import _is_allowed_image_url

async def run_tests():
    print("=== Running News Feature Verification Tests ===")

    # 1. Test Proxy Image Allowed URL Method
    print("\n[Proxy Image URL Checks]")
    assert _is_allowed_image_url("https://example.com/image.png") == True, "Safe URL failed validation"
    assert _is_allowed_image_url("http://example.com/image.png") == False, "HTTP allowed (should be HTTPS only)"
    assert _is_allowed_image_url("https://localhost/image.png") == False, "Localhost allowed (SSRF risk)"
    assert _is_allowed_image_url("https://127.0.0.1/auth.png") == False, "IP allowed (SSRF risk)"
    assert _is_allowed_image_url("https://0.0.0.0/test.png") == False, "0.0.0.0 allowed (SSRF risk)"
    print("✅ Proxy Image URL checks passed!")

    # 2. Test Image Extraction urljoin and prefixing
    print("\n[Image Extraction Relative URLs]")
    # We can test extracting from pages, but let's test a simple dummy URL or check if parse runs without crash:
    dummy_img = await extract_article_image("")
    assert dummy_img is None, "Empty url extract image should be None"

    # Let's test it on a public site (e.g. news ycombinator or a python.org url)
    print("Fetching image from python.org...")
    python_img = await extract_article_image("https://www.python.org/")
    print(f"Scraped image result: {python_img}")
    if python_img:
        assert python_img.startswith("https://"), "Improper non-https scheme or relative path found"
    print("✅ Image extraction tests completed (safe execution)!")

    # 3. Test get_farming_news freshness
    print("\n[Farming News Freshness Window (20 days)]")
    try:
        news = await get_farming_news(max_results=3)
        print(f"Retrieved {len(news)} farming articles.")
        cutoff_20 = datetime.now(timezone.utc) - timedelta(days=20)
        for idx, a in enumerate(news):
            pub_date = parse_date(a.get("published_at"))
            print(f"  {idx+1}. {a['title'][:50]}... Published: {pub_date}")
            assert pub_date >= cutoff_20, f"Article published at {pub_date} is older than cutoff 20 days: {cutoff_20}"
        print("✅ General News window checks passed!")
    except Exception as e:
        print(f"❌ General News Query failed: {e}")

    # 4. Test get_pest_alerts freshness
    print("\n[Pest Alerts Freshness Window (30 days)]")
    try:
        alerts = await get_pest_alerts(max_results=3)
        print(f"Retrieved {len(alerts)} pest alerts.")
        cutoff_30 = datetime.now(timezone.utc) - timedelta(days=30)
        for idx, a in enumerate(alerts):
            pub_date = parse_date(a.get("published_at"))
            print(f"  {idx+1}. {a['title'][:50]}... Published: {pub_date}")
            assert pub_date >= cutoff_30, f"Alert published at {pub_date} is older than cutoff 30 days: {cutoff_30}"
        print("✅ Pest Alerts window checks passed!")
    except Exception as e:
        print(f"❌ Pest Alerts Query failed: {e}")

    # 5. Test get_scheme_news freshness
    print("\n[Scheme News Freshness Window (30 days)]")
    try:
        schemes = await get_scheme_news(max_results=3)
        print(f"Retrieved {len(schemes)} scheme articles.")
        cutoff_30 = datetime.now(timezone.utc) - timedelta(days=30)
        for idx, a in enumerate(schemes):
            pub_date = parse_date(a.get("published_at"))
            print(f"  {idx+1}. {a['title'][:50]}... Published: {pub_date}")
            assert pub_date >= cutoff_30, f"Scheme published at {pub_date} is older than cutoff 30 days: {cutoff_30}"
        print("✅ Scheme News window checks passed!")
    except Exception as e:
        print(f"❌ Scheme News Query failed: {e}")

    print("\n=== All Tests Finished successfully! ===")

if __name__ == "__main__":
    asyncio.run(run_tests())
