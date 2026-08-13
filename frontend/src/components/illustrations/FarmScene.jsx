// Hand-built vector illustration (not a stock photo) so there's no
// licensing risk and it's drawn straight from this app's own palette
// (primary #9A3412 terracotta soil, accent #166534 crop green, the warm
// cream bg). A soft sunrise over rolling, furrowed fields — meant to sit
// as a full-bleed background behind hero/section text, not as a standalone
// image. `variant="wide"` is for full-width sections (landing hero, CTA);
// `variant="panel"` is a taller crop meant for a narrower side panel
// (auth screens).
export function FarmScene({ variant = "wide", className = "" }) {
  const viewBox = variant === "panel" ? "0 0 600 900" : "0 0 1400 600";
  const horizonY = variant === "panel" ? 560 : 360;

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMax slice"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBEBE4" />
          <stop offset="55%" stopColor="#F6F7F2" />
          <stop offset="100%" stopColor="#F6F7F2" />
        </linearGradient>
        <radialGradient id="fs-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FDE7DA" />
          <stop offset="100%" stopColor="#F6C6A8" />
        </radialGradient>
        <linearGradient id="fs-hill-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E7F3EA" />
          <stop offset="100%" stopColor="#CFE6D5" />
        </linearGradient>
        <linearGradient id="fs-hill-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#166534" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#124F29" />
        </linearGradient>
      </defs>

      {/* sky */}
      <rect x="0" y="0" width={variant === "panel" ? 600 : 1400} height="100%" fill="url(#fs-sky)" />

      {/* sun */}
      <circle
        cx={variant === "panel" ? 300 : 700}
        cy={horizonY - 90}
        r={variant === "panel" ? 90 : 110}
        fill="url(#fs-sun)"
      />

      {/* birds */}
      {[
        variant === "panel" ? [140, 220] : [280, 120],
        variant === "panel" ? [420, 300] : [980, 90],
        variant === "panel" ? [340, 260] : [1080, 140],
      ].map(([x, y], i) => (
        <path
          key={i}
          d={`M ${x} ${y} q 10 -10 20 0 q 10 -10 20 0`}
          stroke="#9A3412"
          strokeOpacity="0.45"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      ))}

      {/* far rolling hill */}
      <path
        d={
          variant === "panel"
            ? `M 0 ${horizonY - 60} Q 150 ${horizonY - 120} 300 ${horizonY - 60} T 600 ${horizonY - 70} V 900 H 0 Z`
            : `M 0 ${horizonY - 30} Q 350 ${horizonY - 90} 700 ${horizonY - 30} T 1400 ${horizonY - 40} V 600 H 0 Z`
        }
        fill="url(#fs-hill-far)"
      />

      {/* near hill / field with furrow rows */}
      <path
        d={
          variant === "panel"
            ? `M 0 ${horizonY} Q 200 ${horizonY - 40} 600 ${horizonY - 10} V 900 H 0 Z`
            : `M 0 ${horizonY} Q 500 ${horizonY - 40} 1400 ${horizonY - 15} V 600 H 0 Z`
        }
        fill="url(#fs-hill-near)"
      />

      {/* furrow rows — simple crop-row texture across the near field */}
      <g stroke="#F6F7F2" strokeOpacity="0.16" strokeWidth="6" strokeLinecap="round">
        {Array.from({ length: variant === "panel" ? 9 : 16 }).map((_, i) => {
          const total = variant === "panel" ? 9 : 16;
          const w = variant === "panel" ? 600 : 1400;
          const x = (w / total) * i + 20;
          const yStart = horizonY + 20 + (variant === "panel" ? i * 2 : i * 0.5);
          const yEnd = variant === "panel" ? 900 : 600;
          return <path key={i} d={`M ${x} ${yStart} L ${x - 40} ${yEnd}`} />;
        })}
      </g>
    </svg>
  );
}