"""
One-time seed script — inserts a handful of major, currently-active
government farming schemes as admin-curated announcements (structured
scheme cards), so farmers have something real and useful in the
Announcements tab immediately, without needing to type them all in
through the admin UI by hand first.

Run once from the backend/ directory:
    python -m scripts.seed_schemes

Safe to re-run — it checks for an existing announcement with the same
title before inserting, so it won't create duplicates.

IMPORTANT — these details were verified via web search as of August 2026.
Scheme amounts, eligibility rules, and portals DO change (the AP scheme
below, for instance, was renamed and its amount increased in 2024/2025) —
re-verify from the official links before trusting these for anything
beyond "a reasonable starting point," and update/edit them from the admin
Announcements page as things change rather than re-running this script.
"""

import asyncio
from datetime import datetime
from app.db.database import connect_db, close_db
from app.db.models import ANNOUNCEMENTS_COLLECTION

SCHEMES = [
    {
        "title": "PM-KISAN — ₹6,000/year direct income support",
        "content": (
            "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN) is the central "
            "government's direct income support scheme for landholding "
            "farmer families across India. Payments go straight to your "
            "Aadhaar-linked bank account — no middlemen."
        ),
        "benefit": "₹6,000/year, paid in 3 installments of ₹2,000 every 4 months, via DBT",
        "eligibility": "Landholding farmer families with cultivable land (subject to a few exclusions — government employees, income-tax payers, and a few other categories are not eligible)",
        "where_to_apply": "Nearest Common Service Centre (CSC), your Village/Mandal Agriculture office, or online at pmkisan.gov.in — eKYC is mandatory to receive payments",
        "official_link": "https://pmkisan.gov.in",
        "posted_by": "System (verified Aug 2026)",
    },
    {
        "title": "Annadata Sukhibhava (formerly YSR Rythu Bharosa) — ₹20,000/year for AP farmers",
        "content": (
            "Andhra Pradesh's flagship farmer income-support scheme. It was "
            "previously known as YSR Rythu Bharosa (₹13,500/year) and was "
            "renamed and increased under the current AP government. If "
            "you were receiving Rythu Bharosa before and payments stopped, "
            "this is why — you may need to re-check your registration "
            "under the new scheme name."
        ),
        "benefit": "₹20,000/year total — ₹14,000 from the AP state government + ₹6,000 from the central PM-KISAN scheme (included, not extra) — paid in 3 seasonal installments via DBT",
        "eligibility": "Land-owning farmer families in Andhra Pradesh, plus eligible tenant farmers holding a valid Crop Cultivator Rights Card (CCRC)",
        "where_to_apply": "Nearest Rythu Seva Kendra or Village Secretariat — bring Aadhaar, bank passbook, and land documents. Check your payment status at the official portal.",
        "official_link": "https://annadathasukhibhava.ap.gov.in",
        "posted_by": "System (verified Aug 2026)",
    },
    {
        "title": "PMFBY — low-cost crop insurance against weather/pest losses",
        "content": (
            "Pradhan Mantri Fasal Bima Yojana (PMFBY) covers crop losses "
            "from drought, floods, hailstorms, cyclones, pests, and "
            "disease. It's voluntary — including for farmers with a "
            "Kisan Credit Card loan — and heavily subsidized, so your "
            "share of the premium is small."
        ),
        "benefit": "Your premium share is capped at 2% of sum insured for Kharif crops, 1.5% for Rabi crops, and 5% for commercial/horticultural crops — the government covers the rest",
        "eligibility": "Any farmer — owner-cultivator, tenant, or sharecropper — growing a notified crop in a notified area for that season",
        "where_to_apply": "If you have a Kisan Credit Card loan for a notified crop, your bank usually enrolls you automatically. Without a loan, apply at your bank branch, a CSC, or online at pmfby.gov.in — deadlines vary by state and season, so confirm your cut-off date locally.",
        "official_link": "https://pmfby.gov.in",
        "posted_by": "System (verified Aug 2026)",
    },
    {
        "title": "Kisan Credit Card (KCC) — low-interest farming credit",
        "content": (
            "The Kisan Credit Card gives farmers quick, collateral-free "
            "access to short-term credit for crop production, working "
            "capital, and other farming needs, at subsidized interest "
            "rates compared to regular loans."
        ),
        "benefit": "Collateral-free short-term credit at subsidized interest rates for farming and allied needs (exact limit and rate depend on your land and bank — ask your branch)",
        "eligibility": "Farmers (owners, tenants, sharecroppers), including those involved in animal husbandry and fisheries",
        "where_to_apply": "Any nearby bank branch (public or cooperative) or Common Service Centre",
        "official_link": "",
        "posted_by": "System (verified Aug 2026)",
    },
]


async def seed():
    await connect_db()
    from app.db import database

    inserted, skipped = 0, 0
    for scheme in SCHEMES:
        existing = await database.db[ANNOUNCEMENTS_COLLECTION].find_one({"title": scheme["title"]})
        if existing:
            print(f"⏭️  Already exists, skipping: {scheme['title']}")
            skipped += 1
            continue

        doc = {
            **scheme,
            "image_url":  None,
            "created_at": datetime.utcnow(),
            "updated_at": None,
        }
        await database.db[ANNOUNCEMENTS_COLLECTION].insert_one(doc)
        print(f"✅ Inserted: {scheme['title']}")
        inserted += 1

    print(f"\nDone — {inserted} inserted, {skipped} already existed.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(seed())