import asyncio, httpx
import xml.etree.ElementTree as ET

async def test():
    url = "https://news.google.com/rss/search?q=agriculture+farming+crop&hl=en-IN&gl=IN&ceid=IN:en"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(url)
        root = ET.fromstring(r.text)
        items = root.findall("./channel/item")
        
        with open("rss_tags_clean.txt", "w", encoding="utf-8") as f:
            f.write(f"Total RSS items: {len(items)}\n")
            for i in range(min(5, len(items))):
                item = items[i]
                f.write(f"\n--- Item {i} ---\n")
                f.write(f"Title: {item.findtext('title')}\n")
                for child in item:
                    # Strip namespace tags
                    tag_name = child.tag.split("}")[-1]
                    f.write(f"  <{tag_name}> {dict(child.attrib)}: {child.text or ''}\n")

asyncio.run(test())
