import asyncio, os, sys, httpx
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import connect_db, close_db
from app.utils.news_utils import get_farming_news

async def verify():
    await connect_db()
    news = await get_farming_news(max_results=20)
    
    with open("check_news_images_clean.txt", "w", encoding="utf-8") as f:
        f.write(f"Total articles found: {len(news)}\n")
        
        async with httpx.AsyncClient(timeout=5) as client:
            for i, a in enumerate(news):
                img_url = a.get("image")
                title = a.get("title", "")[:60]
                src = a.get("source", "?")
                
                if not img_url:
                    f.write(f"[{i}] [{src}] '{title}' -> No Image Url (Image=None)\n")
                    continue
                    
                # Attempt to fetch directly
                try:
                    r_direct = await client.get(img_url)
                    direct_status = r_direct.status_code
                except Exception as e:
                    direct_status = f"FAILED ({type(e).__name__})"
                    
                # Attempt to fetch via proxy
                proxy_url = f"http://localhost:8000/news/image-proxy?url={img_url}"
                try:
                    r_proxy = await client.get(proxy_url)
                    proxy_status = r_proxy.status_code
                    proxy_mime = r_proxy.headers.get("content-type", "none")
                except Exception as e:
                    proxy_status = f"FAILED ({type(e).__name__})"
                    proxy_mime = "none"
                    
                f.write(f"[{i}] [{src}] '{title}' -> Image Url: {img_url}\n")
                f.write(f"    Direct status: {direct_status}\n")
                f.write(f"    Proxy status:  {proxy_status} ({proxy_mime})\n")
                
    await close_db()

asyncio.run(verify())
