import sys
sys.path.append('d:/exp1/farmer-assistant/backend')
import asyncio
from app.utils.agmarknet_utils import sync_state_prices

async def main():
    try:
        count = await sync_state_prices('Andhra Pradesh')
        print(f"Success: {count} records synced")
    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")

if __name__ == "__main__":
    asyncio.run(main())
