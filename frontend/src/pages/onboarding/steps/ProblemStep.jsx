import { useTranslation } from "react-i18next";

const OPTIONS = ["pests", "water", "price", "disease"];

export function ProblemStep({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <div>
      <h2 className="text-xl mb-1">{t("problemStep.title")}</h2>
      <p className="text-sm text-ink-soft mb-5">{t("problemStep.subtitle")}</p>
      <div className="flex flex-col gap-2.5">
        {OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-sm border px-4 py-3 text-sm font-medium text-left transition-colors duration-150 ${
              value === opt ? "border-primary bg-primary-tint text-primary" : "border-border bg-surface text-ink hover:border-ink-soft"
            }`}
          >
            {t(`problem.${opt}`)}
          </button>
        ))}
      </div>
    </div>
  );
}