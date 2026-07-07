"""
Scheduler — runs the daily farm report (+ alert if needed) for every
onboarded farmer at the time configured in .env
(AGENT_SCHEDULE_HOUR:AGENT_SCHEDULE_MINUTE).

Each farmer now potentially gets TWO WhatsApp messages from one run:
1. Daily report — always sent
2. Alert — only sent if generate_daily_report flagged alert_needed=True
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.db.database import get_db
from app.db.models import FARMER_PROFILES_COLLECTION
from app.agents.supervisor import generate_daily_report
from app.utils.whatsapp_utils import send_whatsapp_message
from app.core.config import settings

scheduler = AsyncIOScheduler()


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
    """Registers the daily job and starts the scheduler. Called once on app startup."""
    scheduler.add_job(
        run_daily_reports_for_all_farmers,
        trigger="cron",
        hour=settings.AGENT_SCHEDULE_HOUR,
        minute=settings.AGENT_SCHEDULE_MINUTE,
        id="daily_farm_reports",
        replace_existing=True
    )
    scheduler.start()
    print(f"✅ Scheduler started — daily reports will run at "
          f"{settings.AGENT_SCHEDULE_HOUR:02d}:{settings.AGENT_SCHEDULE_MINUTE:02d}")


def stop_scheduler():
    """Called on app shutdown."""
    if scheduler.running:
        scheduler.shutdown()
        print("✅ Scheduler stopped")