import asyncio, os, sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.db.database import connect_db, close_db, get_db

async def go():
    await connect_db()
    db = get_db()
    users = await db['users'].find().to_list(10)
    for u in users:
        print(f"USER: {u.get('username')}, ROLE: {u.get('role')}")
    await close_db()

asyncio.run(go())
