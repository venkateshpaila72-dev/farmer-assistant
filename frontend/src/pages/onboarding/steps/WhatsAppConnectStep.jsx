import { useTranslation } from "react-i18next";
import { WhatsAppOptInCard } from "../../../components/whatsapp/WhatsAppOptInCard";

// No value/onChange props — this step doesn't collect data, it's purely
// the WhatsApp opt-in prompt. Always valid (see isStepValid's default
// case in OnboardingFlow) since we have no way to confirm server-side
// that the farmer actually sent the join message.
export function WhatsAppConnectStep() {
  const { t } = useTranslation();

  return (
    <div>
      <h2 className="text-xl mb-1">{t("whatsappStep.title")}</h2>
      <p className="text-sm text-ink-soft mb-5">{t("whatsappStep.subtitle")}</p>
      <WhatsAppOptInCard />
    </div>
  );
}