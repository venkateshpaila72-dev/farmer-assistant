import { useTranslation } from "react-i18next";
import { LANGUAGE_OPTIONS } from "../../../i18n";

// Maps the site's i18next codes to the exact display-name strings the
// backend's OnboardingData.chat_language field expects.
const CODE_TO_BACKEND_NAME = {
  en: "English", hi: "Hindi", te: "Telugu", ta: "Tamil",
  kn: "Kannada", mr: "Marathi", bn: "Bengali", pa: "Punjabi",
};

export function LanguageStep({ value, onChange }) {
  const { t, i18n } = useTranslation();

  function handleSelect(code) {
    i18n.changeLanguage(code); // re-renders the rest of onboarding immediately
    onChange(CODE_TO_BACKEND_NAME[code]);
  }

  return (
    <div>
      <h2 className="text-xl mb-1">{t("languageStep.title")}</h2>
      <p className="text-sm text-ink-soft mb-5">{t("languageStep.subtitle")}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {LANGUAGE_OPTIONS.map((opt) => (
          <button
            key={opt.code}
            type="button"
            onClick={() => handleSelect(opt.code)}
            className={`rounded-sm border px-3.5 py-3 text-sm font-medium text-left transition-colors duration-150 ${
              i18n.language === opt.code ? "border-primary bg-primary-tint text-primary" : "border-border bg-surface text-ink hover:border-ink-soft"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}