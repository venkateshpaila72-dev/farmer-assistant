import { useTranslation } from "react-i18next";
import { Input } from "../../../components/ui/Input";

export function FarmSizeStep({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <div>
      <h2 className="text-xl mb-1">{t("farmSizeStep.title")}</h2>
      <p className="text-sm text-ink-soft mb-5">{t("farmSizeStep.subtitle")}</p>
      <Input
        type="number"
        min="0.1"
        step="0.1"
        inputMode="decimal"
        placeholder={t("farmSizeStep.placeholder")}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : parseFloat(e.target.value))}
      />
    </div>
  );
}