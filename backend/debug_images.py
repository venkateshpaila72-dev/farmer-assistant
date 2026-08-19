import asyncio, sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import connect_db, close_db
from app.utils.news_utils import get_farming_news

async def go():
    await connect_db()
    news = await get_farming_news(max_results=6)
    print(f"Total articles: {len(news)}")
    for i, a in enumerate(news):
        img = a.get("image")
        src = (a.get("source") or "?")[:30]
        title = a.get("title", "")[:50].encode("ascii", "replace").decode()
        print(f"\n[{i}] {src}")
        print(f"    Title: {title}")
        print(f"    Image: {img}")
    await close_db()

asyncio.run(go())
