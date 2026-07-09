"""
Scheduler — runs the daily farm report (+ alert if needed) for every
onboarded farmer at the time configured in .env
(AGENT_SCHEDULE_HOUR:AGENT_SCHEDULE_MINUTE).

Each farmer now potentially gets TWO WhatsApp messages from one run:
1. Daily report — always sent
2. Alert — only sent if generate_daily_report flagged alert_needed=True
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta
from app.db.database import get_db
from app.db.models import FARMER_PROFILES_COLLECTION, MARKET_PRICES_COLLECTION
from app.agents.supervisor import generate_daily_report
from app.utils.whatsapp_utils import send_whatsapp_message
from app.utils.agmarknet_utils import sync_state_prices
from app.core.config import settings

scheduler = AsyncIOScheduler()

# Same retention window as the manual CSV upload path (app/routes/market.py)
# — kept here too since the automatic sync bypasses that upload path entirely.
RETENTION_WEEKS = 2


async def sync_daily_market_prices():
    """
    Runs once a day, before the farmer report job, so market data is fresh
    when the report is generated. Pulls live AGMARKNET prices for every
    state that has at least one onboarded farmer — not all of India — to
    keep the run fast and stay within the AGMARKNET API's rate limit.
    """
    db = get_db()

    states = await db[FARMER_PROFILES_COLLECTION].distinct(
        "current_location.state",
        {"onboarding_complete": True}
    )
    states = [s for s in states if s]  # drop any empty/missing values

    print(f"\n💰 Market price sync started — {len(states)} state(s)")

    synced  = 0
    failed  = 0
    for state in states:
        try:
            count = await sync_state_prices(state)
            print(f"  ✅ {state}: {count} price records synced")
            synced += 1
        except Exception as e:
            print(f"  ❌ {state}: sync failed — {type(e).__name__}: {e}")
            failed += 1

    print(f"💰 Market price sync complete — states synced: {synced}, failed: {failed}\n")

    # Prune old records — same 2-week retention the manual CSV upload path
    # enforces, kept here since this job is now the primary way data arrives.
    cutoff = datetime.utcnow() - timedelta(weeks=RETENTION_WEEKS)
    deleted = await db[MARKET_PRICES_COLLECTION].delete_many({"uploaded_at": {"$lt": cutoff}})
    print(f"🗑️  Old market records deleted: {deleted.deleted_count}")

    return {"states_synced": synced, "states_failed": failed}


async def run_daily_reports_for_all_farmers():
    """
    Core job — runs generate_daily_report() for every farmer with a
    completed onboarding. Sends the daily report message always, and the
    alert message additionally if one was generated.
    """
    db = get_db()

    farmers = await db[FARMER_PROFILES_COLLECTION].find(
        {"onboarding_complete": True},
        {"username": 1, "_id": 0}
    ).to_list(length=None)

    total          = len(farmers)
    reports_sent   = 0
    alerts_sent    = 0
    failed         = 0

    print(f"\n📅 Daily report run started — {total} onboarded farmers")

    for farmer in farmers:
        username = farmer["username"]
        try:
            result = await generate_daily_report(username)

            if not result.get("success"):
                print(f"  ❌ {username}: {result.get('error', 'unknown error')}")
                failed += 1
                continue

            phone = result.get("phone")
            if not phone:
                print(f"  ⚠️  {username}: no phone number on file, skipping send")
                failed += 1
                continue

            # Send daily report — always, if it generated successfully
            if result.get("daily_report"):
                send_result = await send_whatsapp_message(phone, result["daily_report"])
                if send_result.get("success"):
                    print(f"  ✅ {username}: daily report sent")
                    reports_sent += 1
                else:
                    print(f"  ❌ {username}: daily report send failed — {send_result.get('error')}")
                    failed += 1
            elif result.get("daily_report_error"):
                print(f"  ❌ {username}: {result['daily_report_error']}")
                failed += 1

            # Send alert — only if one was generated
            if result.get("alert_needed") and result.get("alert"):
                alert_send = await send_whatsapp_message(phone, result["alert"])
                if alert_send.get("success"):
                    print(f"  🚨 {username}: ALERT sent")
                    alerts_sent += 1
                else:
                    print(f"  ❌ {username}: alert send failed — {alert_send.get('error')}")
                    failed += 1
            elif result.get("alert_needed") and result.get("alert_error"):
                print(f"  ❌ {username}: {result['alert_error']}")
                failed += 1

        except Exception as e:
            print(f"  ❌ {username}: unexpected error — {str(e)}")
            failed += 1

    print(f"📅 Daily report run complete — reports sent: {reports_sent}, "
          f"alerts sent: {alerts_sent}, failed: {failed}, total farmers: {total}\n")

    return {
        "total":        total,
        "reports_sent": reports_sent,
        "alerts_sent":  alerts_sent,
        "failed":       failed
    }


def start_scheduler():
    """Registers the daily jobs and starts the scheduler. Called once on app startup."""
    # Market price sync — runs first (5 AM), so prices are fresh before
    # the farmer report job (6 AM) reads them.
    scheduler.add_job(
        sync_daily_market_prices,
        trigger="cron",
        hour=5,
        minute=0,
        id="daily_market_sync",
        replace_existing=True
    )

    scheduler.add_job(
        run_daily_reports_for_all_farmers,
        trigger="cron",
        hour=settings.AGENT_SCHEDULE_HOUR,
        minute=settings.AGENT_SCHEDULE_MINUTE,
        id="daily_farm_reports",
        replace_existing=True
    )
    scheduler.start()
    print(f"✅ Scheduler started — market sync at 05:00, "
          f"daily reports at {settings.AGENT_SCHEDULE_HOUR:02d}:{settings.AGENT_SCHEDULE_MINUTE:02d}")


def stop_scheduler():
    """Called on app shutdown."""
    if scheduler.running:
        scheduler.shutdown()
        print("✅ Scheduler stopped")