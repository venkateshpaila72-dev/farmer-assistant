import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { LANGUAGE_OPTIONS } from "../../i18n";

export function LanguageSwitcher({ className }) {
  const { i18n } = useTranslation();

  return (
    <div className={`relative inline-flex items-center ${className || ""}`}>
      <Languages size={15} className="absolute left-2.5 text-ink-soft pointer-events-none" />
      <select
        aria-label="Choose language"
        value={i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="appearance-none bg-transparent border border-border rounded-sm pl-8 pr-3 py-1.5 text-[13px] font-medium text-ink cursor-pointer hover:border-ink-soft transition-colors duration-150 focus:outline-none focus:border-primary"
      >
        {LANGUAGE_OPTIONS.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}