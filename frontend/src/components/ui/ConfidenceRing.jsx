import { motion } from "framer-motion";

/**
 * Small animated circular progress ring showing a confidence percentage.
 * The stroke draws in from 0 on mount/change, and the number counts up
 * alongside it via a plain CSS transition on a key change (no extra
 * dependency needed for a simple 0→N count).
 */
export function ConfidenceRing({ value = 0, size = 64, stroke = 6, color = "currentColor", trackColor = "rgba(255,255,255,0.25)" }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display font-bold" style={{ fontSize: size * 0.26 }}>
        {Math.round(value)}%
      </span>
    </div>
  );
}