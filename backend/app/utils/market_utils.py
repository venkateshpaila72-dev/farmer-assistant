from app.db.database import get_db
from app.db.models import MARKET_PRICES_COLLECTION


async def get_prices_from_db(
    state: str,
    commodity: str = None,
    district: str = None,
    limit: int = 100,
    skip: int = 0
) -> list:
    """
    Fetch market prices from MongoDB.
    Data was uploaded by admin via CSV.
    `skip` supports a "load more" pattern for large states instead of
    fetching everything in one shot.
    """
    db = get_db()

    query = {"state": {"$regex": state, "$options": "i"}}
    if commodity:
        query["commodity"] = {"$regex": commodity, "$options": "i"}
    if district:
        query["district"] = {"$regex": district, "$options": "i"}

    prices = await db[MARKET_PRICES_COLLECTION].find(
        query, {"_id": 0}
    ).sort("arrival_date", -1).skip(skip).limit(limit).to_list(length=limit)

    return prices


async def get_trending_from_db(state: str, limit: int = 5) -> list:
    """
    Calculate trending crops from MongoDB market data.
    Trending = high record count + high average modal price.
    """
    db = get_db()

    pipeline = [
        {"$match": {"state": {"$regex": state, "$options": "i"}}},
        {"$group": {
            "_id":             "$commodity",
            "avg_modal_price": {"$avg": "$modal_price"},
            "max_modal_price": {"$max": "$modal_price"},
            "min_modal_price": {"$min": "$modal_price"},
            "total_records":   {"$sum": 1}
        }},
        {"$addFields": {
            "trending_score": {"$multiply": ["$avg_modal_price", "$total_records"]}
        }},
        {"$sort":  {"trending_score": -1}},
        {"$limit": limit}
    ]

    results = await db[MARKET_PRICES_COLLECTION].aggregate(pipeline).to_list(length=limit)

    return [
        {
            "commodity":      r["_id"],
            "avg_price":      round(r["avg_modal_price"], 2),
            "trending_score": round(r["trending_score"], 2),
            "data_points":    r["total_records"]
        }
        for r in results
    ]