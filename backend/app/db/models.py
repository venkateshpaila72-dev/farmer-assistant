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
ICAR_DOCUMENTS_COLLECTION   = "icar_documents"
PEST_ALERTS_COLLECTION      = "pest_alerts"  # last-known-good GNews pest/disease results, per state — lets the /news/alerts endpoint fall back to a recent past batch instead of a bare empty state whenever today's live query finds nothing
SCHEME_NEWS_COLLECTION      = "scheme_news"  # last-known-good GNews government-scheme results, per state — same fallback pattern as pest_alerts, for the /news/schemes endpoint
USER_MEMORIES_COLLECTION    = "user_memories"      # long-term extracted facts per user (preferences, crops, location, etc.)
CHAT_SUMMARIES_COLLECTION   = "chat_summaries"     # compressed summaries of old conversations (beyond last 20 messages)


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

    # pest_alerts — one stored document per state key ("" = general/All India),
    # overwritten on every successful live fetch; unique so the upsert in
    # routes/news.py always replaces rather than accumulating duplicates.
    await db[PEST_ALERTS_COLLECTION].create_index("state_key", unique=True)
    await db[SCHEME_NEWS_COLLECTION].create_index("state_key", unique=True)

    # user_memories — one document per farmer, storing long-term extracted facts
    await db[USER_MEMORIES_COLLECTION].create_index("username", unique=True)

    # chat_summaries — one document per farmer, storing compressed old conversations
    await db[CHAT_SUMMARIES_COLLECTION].create_index("username", unique=True)

    print("✅ MongoDB indexes created")