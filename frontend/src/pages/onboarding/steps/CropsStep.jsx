import { useTranslation } from "react-i18next";

const CROPS = [
  "Rice", "Wheat", "Cotton", "Sugarcane", "Maize", "Groundnut",
  "Soybean", "Tomato", "Onion", "Chilli", "Mustard", "Gram",
];

export function CropsStep({ value = [], onChange }) {
  const { t } = useTranslation();

  function toggle(crop) {
    if (value.includes(crop)) {
      onChange(value.filter((c) => c !== crop));
    } else {
      onChange([...value, crop]);
    }
  }

  return (
    <div>
      <h2 className="text-xl mb-1">{t("cropsStep.title")}</h2>
      <p className="text-sm text-ink-soft mb-5">{t("cropsStep.subtitle")}</p>
      <div className="flex flex-wrap gap-2">
        {CROPS.map((crop) => (
          <button
            key={crop}
            type="button"
            onClick={() => toggle(crop)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-150 ${
              value.includes(crop) ? "border-primary bg-primary-tint text-primary" : "border-border bg-surface text-ink hover:border-ink-soft"
            }`}
          >
            {t(`crops.${crop}`)}
          </button>
        ))}
      </div>
      {value.length === 0 && <p className="text-xs text-ink-soft mt-3">{t("cropsStep.selectAtLeastOne")}</p>}
    </div>
  );
}