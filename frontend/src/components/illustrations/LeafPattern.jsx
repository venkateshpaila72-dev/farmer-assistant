// A quiet, repeating sprout motif — for adding texture to a solid-color
// block (e.g. the primary-colored CTA band) without competing with the
// text on top of it. Kept to a single low-opacity color so it reads as
// texture, not decoration.
export function LeafPattern({ className = "", opacity = 0.08 }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern id="leaf-pattern" width="90" height="90" patternUnits="userSpaceOnUse">
          <path
            d="M45 70 C 45 50, 45 40, 45 20 M45 20 C 35 28, 30 34, 28 42 M45 30 C 55 38, 60 44, 62 52"
            stroke="#FFFFFF"
            strokeOpacity={opacity}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#leaf-pattern)" />
    </svg>
  );
}