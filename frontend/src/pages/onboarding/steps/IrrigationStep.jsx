const OPTIONS = [
  { value: "rainfall", label: "Rain-fed" },
  { value: "canal", label: "Canal" },
  { value: "borewell", label: "Borewell" },
];

export function IrrigationStep({ value, onChange }) {
  return (
    <div>
      <h2 className="text-xl mb-1">How do you water your fields?</h2>
      <p className="text-sm text-ink-soft mb-5">Your main source &mdash; it&rsquo;s fine if you use more than one sometimes.</p>
      <div className="flex flex-col gap-2.5">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-sm border px-4 py-3 text-sm font-medium text-left transition-colors duration-150 ${
              value === opt.value ? "border-primary bg-primary-tint text-primary" : "border-border bg-surface text-ink hover:border-ink-soft"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}