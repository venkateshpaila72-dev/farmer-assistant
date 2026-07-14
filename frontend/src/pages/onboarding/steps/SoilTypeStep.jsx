const SOIL_TYPES = ["Alluvial", "Black", "Red", "Laterite", "Sandy", "Clay", "Loamy"];

export function SoilTypeStep({ value, onChange }) {
  return (
    <div>
      <h2 className="text-xl mb-1">What&rsquo;s your soil type?</h2>
      <p className="text-sm text-ink-soft mb-5">If you&rsquo;re not sure, pick your best guess &mdash; you can update this later.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {SOIL_TYPES.map((soil) => (
          <button
            key={soil}
            type="button"
            onClick={() => onChange(soil)}
            className={`rounded-sm border px-3.5 py-3 text-sm font-medium text-left transition-colors duration-150 ${
              value === soil ? "border-primary bg-primary-tint text-primary" : "border-border bg-surface text-ink hover:border-ink-soft"
            }`}
          >
            {soil}
          </button>
        ))}
      </div>
    </div>
  );
}