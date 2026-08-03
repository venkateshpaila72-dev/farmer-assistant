import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import hi from "./locales/hi.json";
import te from "./locales/te.json";
import ta from "./locales/ta.json";
import kn from "./locales/kn.json";
import mr from "./locales/mr.json";
import bn from "./locales/bn.json";
import pa from "./locales/pa.json";

// Maps the display names used in the onboarding language picker to i18next
// language codes. Keep this in sync with LanguageStep's option list.
export const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "pa", label: "ਪੰਜਾਬੀ (Punjabi)" },
];

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    te: { translation: te },
    ta: { translation: ta },
    kn: { translation: kn },
    mr: { translation: mr },
    bn: { translation: bn },
    pa: { translation: pa },
  },
  lng: localStorage.getItem("language") || "en", // always English until explicitly chosen
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// Keep the choice across visits/reloads. AuthContext.jsx additionally
// syncs this to the farmer's saved chat_language automatically at login.
i18n.on("languageChanged", (lng) => {
  localStorage.setItem("language", lng);
});

export default i18n;