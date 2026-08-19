import asyncio, os, sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.db.database import connect_db, close_db, get_db
from app.core.security import hash_password

async def go():
    await connect_db()
    db = get_db()
    hashed = hash_password("password")
    await db['users'].update_one({"username": "ramu123"}, {"$set": {"password": hashed}})
    print("Updated ramu123 password to 'password'!")
    await close_db()

asyncio.run(go())
