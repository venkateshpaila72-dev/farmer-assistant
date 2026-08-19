import { useTranslation } from "react-i18next";
import { MessageCircle } from "lucide-react";

// Twilio's WhatsApp Sandbox needs each phone number to opt in once by
// sending "join <code>" to Twilio's sandbox number before it can receive
// messages from this app. The join code is the SAME for every farmer —
// it's tied to this app's Twilio account, not generated per-user — so we
// can just show it once here instead of sending people to Twilio's own
// site to find it.
//
// Both values are safe to expose in the frontend bundle (not secrets,
// they're literally meant to be shown to end users to onboard them).
const SANDBOX_NUMBER = import.meta.env.VITE_WHATSAPP_SANDBOX_NUMBER || "14155238886";
const JOIN_CODE = import.meta.env.VITE_WHATSAPP_JOIN_CODE || "";

function digitsOnly(v) {
  return (v || "").replace(/[^\d]/g, "");
}

export function WhatsAppOptInCard({ className = "" }) {
  const { t } = useTranslation();

  if (!JOIN_CODE) {
    // Nothing configured yet — fail quietly rather than show a broken
    // QR/link. See frontend/.env.example for the two variables to set.
    return null;
  }

  const joinText = `join ${JOIN_CODE}`;
  const waLink = `https://wa.me/${digitsOnly(SANDBOX_NUMBER)}?text=${encodeURIComponent(joinText)}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(waLink)}`;

  return (
    <div className={`rounded-md border border-border bg-surface p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <MessageCircle size={18} className="text-accent" />
        <h3 className="text-base font-semibold text-ink">{t("whatsappOptIn.title")}</h3>
      </div>
      <p className="text-sm text-ink-soft mb-4">{t("whatsappOptIn.description")}</p>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <img
          src={qrSrc}
          alt={t("whatsappOptIn.qrAlt")}
          width={140}
          height={140}
          className="rounded-sm border border-border shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ink-soft mb-3">{t("whatsappOptIn.scanHint")}</p>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-sm bg-accent text-white text-sm font-medium px-4 py-2.5 hover:bg-accent-dark transition-colors duration-150"
          >
            <MessageCircle size={16} />
            {t("whatsappOptIn.openButton")}
          </a>
          <p className="text-xs text-ink-soft mt-3">
            {t("whatsappOptIn.manualHint")} <span className="font-mono font-medium text-ink">{joinText}</span>
          </p>
        </div>
      </div>
    </div>
  );
}