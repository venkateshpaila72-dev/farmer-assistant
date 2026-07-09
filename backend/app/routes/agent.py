from fastapi import APIRouter, HTTPException, Depends
from app.db.database import get_db
from app.db.models import FARMER_PROFILES_COLLECTION, USERS_COLLECTION
from app.agents.weather_agent import check_weather
from app.agents.soil_agent import check_soil_suitability
from app.agents.disease_agent import check_disease_status
from app.agents.market_agent import check_market_signal
from app.agents.supervisor import generate_daily_report
from app.utils.whatsapp_utils import send_whatsapp_message
from app.utils.scheduler import scheduler, run_daily_reports_for_all_farmers, sync_daily_market_prices
from app.core.config import settings
from app.core.security import get_current_admin

router = APIRouter()

# Every route below is an internal/admin operational tool — it can read any
# farmer's full profile + agent findings, or trigger a real WhatsApp send.
# All gated behind admin auth.


@router.get("/debug/{username}")
async def debug_agents(username: str, admin: dict = Depends(get_current_admin)):
    """
    Run all 4 deterministic agents for one farmer and return RAW findings,
    split into notable (daily report) and dangerous (alert) tiers.
    No Groq call — free and instant, safe to run repeatedly while testing.
    """
    db = get_db()
    profile = await db[FARMER_PROFILES_COLLECTION].find_one({"username": username})

    if not profile:
        raise HTTPException(status_code=404, detail=f"Farmer '{username}' not found")

    location        = profile.get("current_location", profile.get("home_location", {}))
    state           = location.get("state", "India")
    lat             = location.get("lat", 17.97)
    lng             = location.get("lng", 79.59)
    soil_type       = profile.get("soil_type")
    preferred_crops = profile.get("preferred_crops", [])

    weather_result = await check_weather(lat=lat, lng=lng)
    soil_result    = check_soil_suitability(soil_type=soil_type, preferred_crops=preferred_crops)
    disease_result = await check_disease_status(username=username)
    market_result  = await check_market_signal(preferred_crops=preferred_crops, state=state)

    any_danger = any(r.get("danger_found") for r in
                      [weather_result, soil_result, disease_result, market_result])

    return {
        "username":      username,
        "would_trigger_alert": any_danger,
        "weather_agent": weather_result,
        "soil_agent":    soil_result,
        "disease_agent": disease_result,
        "market_agent":  market_result
    }


@router.post("/run-report/{username}")
async def run_report(username: str, send_report: bool = True, send_alert: bool = True, admin: dict = Depends(get_current_admin)):
    """
    Generate the daily report (and alert, if applicable) for ONE farmer
    right now. Daily report is ALWAYS generated. Alert is only generated
    if dangerous conditions were found.

    Use send_report=false / send_alert=false to generate text without
    actually sending via WhatsApp (saves Twilio messages while testing
    the generated wording).
    """
    result = await generate_daily_report(username)

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))

    response = {
        "username":          username,
        "daily_report_text": result.get("daily_report"),
        "alert_needed":      result.get("alert_needed"),
        "alert_text":        result.get("alert"),
        "agent_summary":     result.get("agent_summary"),
        "daily_report_sent": False,
        "alert_sent":        False
    }

    phone = result.get("phone")
    if not phone and (send_report or send_alert):
        response["whatsapp_error"] = "No phone number on file for this farmer"
        return response

    if send_report and result.get("daily_report"):
        send_result = await send_whatsapp_message(phone, result["daily_report"])
        response["daily_report_sent"]   = send_result.get("success", False)
        response["daily_report_detail"] = send_result

    if send_alert and result.get("alert_needed") and result.get("alert"):
        alert_result = await send_whatsapp_message(phone, result["alert"])
        response["alert_sent"]   = alert_result.get("success", False)
        response["alert_detail"] = alert_result

    return response


@router.post("/run-report-all")
async def run_report_all(admin: dict = Depends(get_current_admin)):
    """
    Manually trigger the full daily report run for ALL onboarded farmers
    right now — same job the scheduler runs automatically at 6 AM.
    """
    result = await run_daily_reports_for_all_farmers()
    return result


@router.post("/run-market-sync")
async def run_market_sync(admin: dict = Depends(get_current_admin)):
    """
    Manually trigger the AGMARKNET market price sync right now —
    same job the scheduler runs automatically at 5 AM.
    """
    result = await sync_daily_market_prices()
    return result


@router.get("/scheduler-status")
async def scheduler_status(admin: dict = Depends(get_current_admin)):
    """Check whether the daily report scheduler is registered and running."""
    jobs = scheduler.get_jobs()
    job_info = [
        {"id": job.id, "next_run": job.next_run_time.isoformat() if job.next_run_time else None}
        for job in jobs
    ]

    return {
        "scheduler_running": scheduler.running,
        "scheduled_hour":    settings.AGENT_SCHEDULE_HOUR,
        "scheduled_minute":  settings.AGENT_SCHEDULE_MINUTE,
        "jobs":              job_info
    }


@router.post("/test-whatsapp/{username}")
async def test_whatsapp(username: str, message: str = "Test message from Farmer Assistant agents.", admin: dict = Depends(get_current_admin)):
    """
    Quick isolated test — send an arbitrary message to a farmer's WhatsApp
    without running any agents. Confirms phone number + Twilio setup work.
    """
    db = get_db()
    profile = await db[FARMER_PROFILES_COLLECTION].find_one({"username": username})

    if not profile:
        raise HTTPException(status_code=404, detail=f"Farmer '{username}' not found")

    # Phone lives on the users collection, not farmer_profiles
    user_doc = await db[USERS_COLLECTION].find_one({"username": username})
    phone    = user_doc.get("phone") if user_doc else None

    if not phone:
        raise HTTPException(status_code=400, detail="No phone number on file for this farmer")

    result = await send_whatsapp_message(phone, message)
    return result