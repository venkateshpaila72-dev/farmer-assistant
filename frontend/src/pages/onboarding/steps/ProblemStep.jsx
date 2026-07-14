const OPTIONS = [
  { value: "pests", label: "Pests & disease" },
  { value: "water", label: "Water shortage" },
  { value: "price", label: "Getting a fair price" },
  { value: "disease", label: "Crop health issues" },
];

export function ProblemStep({ value, onChange }) {
  return (
    <div>
      <h2 className="text-xl mb-1">What&rsquo;s your biggest challenge right now?</h2>
      <p className="text-sm text-ink-soft mb-5">We&rsquo;ll prioritize advice around this.</p>
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