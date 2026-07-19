import os
from datetime import datetime

from dotenv import load_dotenv
from pymongo import MongoClient
from passlib.context import CryptContext

# Load environment variables
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DB_NAME = os.getenv("DB_NAME")

# Password hashing (same as FastAPI auth)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Connect to MongoDB
client = MongoClient(MONGODB_URL)
db = client[DB_NAME]
admins = db["admins"]


def create_admin():
    name = input("Enter Name: ").strip()
    email = input("Enter Email: ").strip().lower()
    password = input("Enter Password: ").strip()

    # Check if admin already exists
    if admins.find_one({"email": email}):
        print(f"❌ Admin with email '{email}' already exists.")
        return

    hashed_password = pwd_context.hash(password)

    admin = {
        "name": name,
        "email": email,
        "password": hashed_password,
        "role": "admin",
        "created_at": datetime.utcnow()
    }

    result = admins.insert_one(admin)

    print("\n✅ Admin created successfully!")
    print("ID:", result.inserted_id)


if __name__ == "__main__":
    create_admin()