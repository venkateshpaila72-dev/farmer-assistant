"""
WhatsApp sending utility via Twilio.

Standalone by design — takes a phone number + message, sends it, returns
success/failure. Does not look up the farmer itself; callers (agents,
supervisor) are responsible for fetching the phone number first. This
keeps it testable on its own before any agent logic depends on it.

IMPORTANT — Twilio WhatsApp Sandbox requirement (free trial):
Before this can successfully message a real phone number, that number
must first send the sandbox join code (e.g. "join <code>") to your
Twilio sandbox WhatsApp number from WhatsApp on their phone. This is a
one-time manual step per phone number — no code can bypass it. If a
message fails with an error mentioning "not a valid... sandbox
participant" or similar, this is almost always the cause.
"""

from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from app.core.config import settings

_client = None


def get_twilio_client() -> Client:
    """Lazy-init the Twilio client so import doesn't fail if credentials are
    temporarily missing during early app startup checks."""
    global _client
    if _client is None:
        _client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    return _client


def _format_whatsapp_number(phone: str) -> str:
    """
    Normalize a raw phone number into Twilio's required WhatsApp format:
    'whatsapp:+<country_code><number>'

    Assumes Indian numbers (+91) if no country code is present, since this
    project is India-focused. If the number already starts with 'whatsapp:'
    or '+', it's used as-is.
    """
    phone = phone.strip()

    if phone.startswith("whatsapp:"):
        return phone

    if phone.startswith("+"):
        return f"whatsapp:{phone}"

    # Strip any leading zeros or spaces, assume Indian number if 10 digits
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        return f"whatsapp:+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"whatsapp:+{digits}"

    # Fallback — pass through with + prefix, Twilio will reject if invalid
    return f"whatsapp:+{digits}"


async def send_whatsapp_message(phone: str, message: str) -> dict:
    """
    Send a WhatsApp message to a single phone number.

    Returns a dict with success status and either the Twilio message SID
    (on success) or an error description (on failure) — never raises, so
    callers (e.g. the scheduler processing many farmers) can continue even
    if one farmer's message fails.
    """
    if not phone:
        return {"success": False, "error": "No phone number provided"}

    if not message or not message.strip():
        return {"success": False, "error": "Empty message"}

    to_number = _format_whatsapp_number(phone)

    try:
        client = get_twilio_client()
        msg = client.messages.create(
            from_=settings.TWILIO_WHATSAPP_FROM,
            to=to_number,
            body=message
        )
        return {
            "success":    True,
            "message_sid": msg.sid,
            "to":         to_number,
            "status":     msg.status
        }
    except TwilioRestException as e:
        return {
            "success": False,
            "to":      to_number,
            "error":   f"Twilio error {e.code}: {e.msg}"
        }
    except Exception as e:
        return {
            "success": False,
            "to":      to_number,
            "error":   f"Unexpected error: {str(e)}"
        }