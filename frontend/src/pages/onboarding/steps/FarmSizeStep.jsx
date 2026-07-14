import { Input } from "../../../components/ui/Input";

export function FarmSizeStep({ value, onChange }) {
  return (
    <div>
      <h2 className="text-xl mb-1">How big is your farm?</h2>
      <p className="text-sm text-ink-soft mb-5">In acres. A rough estimate is fine.</p>
      <Input
        type="number"
        min="0.1"
        step="0.1"
        inputMode="decimal"
        placeholder="e.g. 2.5"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : parseFloat(e.target.value))}
      />
    </div>
  );
}