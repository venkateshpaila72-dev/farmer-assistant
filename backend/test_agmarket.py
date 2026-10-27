
import asyncio
import httpx

async def main():
    url = "https://mandi-api.onrender.com/v1/prices"
    params = {"state": "Maharashtra", "commodity": "Onion"}

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(url, params=params)
        print("HTTP:", response.status_code)
        response.raise_for_status()

        payload = response.json()
        print("Success:", payload.get("success"))
        print("Records:", len(payload.get("data", [])))

        for row in payload.get("data", [])[:5]:
            print({
                "market": row.get("market"),
                "commodity": row.get("commodity"),
                "arrival_date": row.get("arrival_date"),
                "modal_price": row.get("modal_price"),
            })

asyncio.run(main())
