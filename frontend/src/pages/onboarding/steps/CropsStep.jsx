const CROPS = [
  "Rice", "Wheat", "Cotton", "Sugarcane", "Maize", "Groundnut",
  "Soybean", "Tomato", "Onion", "Chilli", "Mustard", "Gram",
];

export function CropsStep({ value = [], onChange }) {
  function toggle(crop) {
    if (value.includes(crop)) {
      onChange(value.filter((c) => c !== crop));
    } else {
      onChange([...value, crop]);
    }
  }

  return (
    <div>
      <h2 className="text-xl mb-1">What do you usually grow?</h2>
      <p className="text-sm text-ink-soft mb-5">Pick as many as apply. This shapes your market prices and advice.</p>
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
            {crop}
          </button>
        ))}
      </div>
      {value.length === 0 && <p className="text-xs text-ink-soft mt-3">Select at least one crop to continue.</p>}
    </div>
  );
}