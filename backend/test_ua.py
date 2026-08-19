import asyncio, httpx

async def test():
    url = "https://d3lzcn6mbbadaf.cloudfront.net/media/details/__sized__/ANI-20260818170333-thumbnail-320x180-70.jpg"
    
    headers_custom = {
        "User-Agent": "Mozilla/5.0 (compatible; FarmerAssistant/1.0)",
        "Accept": "image/*",
    }
    
    headers_browser = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r1 = await client.get(url, headers=headers_custom)
            print(f"Custom UA status: {r1.status_code}")
        except Exception as e:
            print(f"Custom UA error: {type(e).__name__}: {e}")
            
        try:
            r2 = await client.get(url, headers=headers_browser)
            print(f"Browser UA status: {r2.status_code}")
        except Exception as e:
            print(f"Browser UA error: {type(e).__name__}: {e}")

asyncio.run(test())
