import asyncio
import os
import sys
import io

# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import connect_db, close_db
from app.utils.news_utils import get_farming_news, get_pest_alerts, get_scheme_news, parse_date

async def test():
    try:
        await connect_db()
    except Exception as e:
        print(f"DB warning: {e}")

    print("=== 1. GLOBAL NEWS (no country lock) ===")
    news = await get_farming_news(max_results=5)
    print(f"Returned: {len(news)}")
    for a in news:
        t = a['title'][:70].encode('ascii', 'replace').decode()
        src = (a.get('source') or '?').encode('ascii', 'replace').decode()
        print(f"  [{src}] {t}")
        print(f"    published_at: {a['published_at']}")
    print()

    print("=== 2. PEST ALERTS - All India ===")
    alerts_all = await get_pest_alerts(state=None, max_results=5)
    print(f"Returned: {len(alerts_all)}")
    has_foreign = False
    for a in alerts_all:
        t = a['title'][:70].encode('ascii', 'replace').decode()
        src = (a.get('source') or '?').encode('ascii', 'replace').decode()
        print(f"  [{src}] {t}")
        low = a['title'].lower()
        if any(x in low for x in ['california', 'europe', 'australia', 'africa', 'united states']):
            print(f"    WARNING: FOREIGN ALERT DETECTED")
            has_foreign = True
    if not has_foreign:
        print("  OK: No foreign alerts detected")
    print()

    print("=== 3. PEST ALERTS - Andhra Pradesh (no merge) ===")
    alerts_ap = await get_pest_alerts(state="Andhra Pradesh", max_results=5)
    print(f"Returned: {len(alerts_ap)}")
    for a in alerts_ap:
        t = a['title'][:70].encode('ascii', 'replace').decode()
        src = (a.get('source') or '?').encode('ascii', 'replace').decode()
        print(f"  [{src}] {t}")
    print()

    print("=== 4. SCHEMES - All India ===")
    schemes = await get_scheme_news(state="Andhra Pradesh", max_results=3)
    print(f"Returned: {len(schemes)} (should ignore AP param)")
    for a in schemes:
        t = a['title'][:70].encode('ascii', 'replace').decode()
        src = (a.get('source') or '?').encode('ascii', 'replace').decode()
        print(f"  [{src}] {t}")
    print()

    await close_db()
    print("=== DONE ===")

if __name__ == "__main__":
    asyncio.run(test())
