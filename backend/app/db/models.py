# MongoDB collection names — single source of truth
# Always import from here — never hardcode collection names anywhere

USERS_COLLECTION            = "users"
ADMINS_COLLECTION           = "admins"
FARMER_PROFILES_COLLECTION  = "farmer_profiles"
CHAT_HISTORY_COLLECTION     = "chat_history"
FARM_REPORTS_COLLECTION     = "farm_reports"
DISEASE_LOGS_COLLECTION     = "disease_logs"
ANNOUNCEMENTS_COLLECTION    = "announcements"
MARKET_PRICES_COLLECTION    = "market_prices"


async def create_indexes(db):
    """
    Creates MongoDB indexes on app startup.
    Indexes make queries faster — especially for farmer username lookups.
    Safe to run multiple times — MongoDB ignores if index already exists.
    """

    # users — username must be unique
    await db[USERS_COLLECTION].create_index("username", unique=True)

    # admins — email must be unique
    await db[ADMINS_COLLECTION].create_index("email", unique=True)

    # farmer_profiles — one profile per farmer
    await db[FARMER_PROFILES_COLLECTION].create_index("username", unique=True)

    # chat_history — fast lookup by username
    await db[CHAT_HISTORY_COLLECTION].create_index("username")

    # farm_reports — fast lookup by username + latest date first
    await db[FARM_REPORTS_COLLECTION].create_index(
        [("username", 1), ("date", -1)]
    )

    # disease_logs — fast lookup by username
    await db[DISEASE_LOGS_COLLECTION].create_index("username")

    # market_prices — fast lookup by state + commodity + latest date
    await db[MARKET_PRICES_COLLECTION].create_index(
        [("state", 1), ("commodity", 1), ("date", -1)]
    )

    print("✅ MongoDB indexes created")