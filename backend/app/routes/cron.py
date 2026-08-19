"""
Cron trigger route — for hosts where the app process sleeps when idle
(Render/Railway free tier etc). The in-process APScheduler in
app/utils/scheduler.py only fires if the process happens to already be
running at the scheduled minute, which a sleeping free-tier service can't
guarantee.

This route lets an external scheduler (cron-job.org, GitHub Actions
scheduled workflow, UptimeRobot heartbeat, ...) hit a real HTTP endpoint
a bit before 6 AM. The incoming request itself wakes the service, and the
handler runs the same jobs the internal scheduler would have — awaited
in full before responding, so the platform sees active traffic for the
whole run and won't spin the service back down partway through.

Protected by a shared-secret header (not the admin JWT flow) since the
caller is a scheduler service, not a logged-in admin.
"""

from fastapi import APIRouter, HTTPException, status, Header
from typing import Optional
from app.core.config import settings
from app.utils.scheduler import sync_daily_market_prices, run_daily_reports_for_all_farmers

router = APIRouter()


def _check_secret(x_cron_secret: Optional[str]):
    if not settings.CRON_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CRON_SECRET is not configured on this server"
        )
    if not x_cron_secret or x_cron_secret != settings.CRON_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing cron secret"
        )


@router.post("/run-daily-jobs")
async def run_daily_jobs(x_cron_secret: Optional[str] = Header(None)):
    """
    Runs market price sync, then the daily farmer report/alert send — the
    same two jobs the internal scheduler runs at 05:00 and 06:00. Call
    this once a day from an external scheduler, timed a few minutes
    before your target delivery time to absorb cold-start latency.
    """
    _check_secret(x_cron_secret)

    market_result = await sync_daily_market_prices()
    reports_result = await run_daily_reports_for_all_farmers()

    return {
        "market_sync": market_result,
        "daily_reports": reports_result
    }


@router.post("/run-market-sync")
async def run_market_sync_only(x_cron_secret: Optional[str] = Header(None)):
    """Market sync only — useful if you want to ping this separately,
    earlier, from the report job."""
    _check_secret(x_cron_secret)
    return await sync_daily_market_prices()


@router.post("/run-reports")
async def run_reports_only(x_cron_secret: Optional[str] = Header(None)):
    """Daily report/alert send only — assumes prices are already fresh."""
    _check_secret(x_cron_secret)
    return await run_daily_reports_for_all_farmers()