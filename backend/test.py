import asyncio
from app.utils.whatsapp_utils import send_whatsapp_message

async def test():
    result = await send_whatsapp_message("7386587706", "Test message from Farmer Assistant")
    print(result)

asyncio.run(test())