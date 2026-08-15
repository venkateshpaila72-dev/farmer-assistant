import { useMemo } from "react";
import { motion } from "framer-motion";
import { useWeatherBackground } from "../../context/WeatherBackgroundContext";

/**
 * Reads the visitor's local clock to pick a time-of-day scene (dawn / day /
 * dusk / night), and layers in rain when the dashboard's real weather data
 * says it's raining (via WeatherBackgroundContext — set once by whichever
 * page fetched the weather, e.g. DashboardHome). Renders entirely with CSS
 * gradients + SVG + framer-motion loops, no image assets, so it's cheap and
 * scales to any screen size.
 *
 * Positioned `absolute inset-0` within its parent (NOT `fixed` — fixed would
 * cover the whole viewport including the sidebar/topbar, which is exactly
 * the bug from earlier). Mount this once inside a `position: relative`
 * container, behind the actual page content.
 */

function getTimeOfDay(hour) {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

const SCENES = {
  dawn: {
    sky: "from-[#ffe3c2] via-[#ffd3b0] to-[#eef2df]",
    sun: true,
    glow: "bg-[#ffb27a]",
    hills: "#8fae5c",
    hillsBack: "#a9c47a",
  },
  day: {
    sky: "from-[#cfeaff] via-[#e6f3e0] to-[#f3f5e6]",
    sun: true,
    glow: "bg-[#ffe9a8]",
    hills: "#5f9a4a",
    hillsBack: "#7fb865",
  },
  dusk: {
    sky: "from-[#a86b8f] via-[#e8a672] to-[#f6d9a8]",
    sun: true,
    glow: "bg-[#ff9d6b]",
    hills: "#3f5c3a",
    hillsBack: "#557650",
  },
  night: {
    sky: "from-[#0f1a30] via-[#182644] to-[#26314a]",
    sun: false,
    glow: "bg-[#8fa8ff]",
    hills: "#111d1a",
    hillsBack: "#1a2b25",
  },
};

const RAINDROPS = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 137.5) % 100}%`,
  delay: (i % 13) * 0.15,
  duration: 0.7 + (i % 5) * 0.08,
  height: 14 + (i % 4) * 6,
}));

const STARS = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 53.7) % 100}%`,
  top: `${(i * 29.3) % 55}%`,
  delay: (i % 6) * 0.4,
  size: 1.5 + (i % 3) * 0.6,
}));

export function WeatherSkyBackground() {
  const { isRaining } = useWeatherBackground();

  const timeOfDay = useMemo(() => getTimeOfDay(new Date().getHours()), []);
  const scene = SCENES[timeOfDay];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Sky gradient, tinted grayer when raining regardless of time of day */}
      <div className={`absolute inset-0 bg-gradient-to-b ${scene.sky} ${isRaining ? "saturate-[0.55] brightness-[0.92]" : ""}`} />

      {/* Rain clouds overlay */}
      {isRaining && (
        <div className="absolute inset-0 bg-gradient-to-b from-slate-500/25 via-slate-400/10 to-transparent" />
      )}

      {/* Sun / moon */}
      {scene.sun && !isRaining && (
        <motion.div
          className={`absolute rounded-full ${scene.glow} blur-2xl opacity-70`}
          style={{ width: 140, height: 140, top: "8%", right: "12%" }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.8, 0.6] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {timeOfDay === "night" && !isRaining && (
        <>
          <motion.div
            className="absolute rounded-full bg-[#f4f1e6] blur-md"
            style={{ width: 46, height: 46, top: "10%", right: "14%" }}
            animate={{ opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
          {STARS.map((s, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full bg-white"
              style={{ left: s.left, top: s.top, width: s.size, height: s.size }}
              animate={{ opacity: [0.2, 0.9, 0.2] }}
              transition={{ duration: 2.4, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
            />
          ))}
        </>
      )}

      {/* Drifting clouds — always present, subtle */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white/40 blur-xl"
          style={{
            width: 120 + i * 40,
            height: 34 + i * 8,
            top: `${10 + i * 12}%`,
            left: `${-20 + i * 10}%`,
          }}
          animate={{ x: ["0%", "140%"] }}
          transition={{ duration: 46 + i * 14, repeat: Infinity, ease: "linear", delay: i * 6 }}
        />
      ))}

      {/* Falling rain */}
      {isRaining && (
        <div className="absolute inset-0">
          {RAINDROPS.map((d, i) => (
            <motion.span
              key={i}
              className="absolute w-px bg-sky-100/70"
              style={{ left: d.left, height: d.height, top: "-5%" }}
              animate={{ y: ["0vh", "115vh"] }}
              transition={{ duration: d.duration, repeat: Infinity, delay: d.delay, ease: "linear" }}
            />
          ))}
        </div>
      )}

      {/* Rolling field silhouette anchoring it to the farm theme */}
      <svg
        className="absolute bottom-0 left-0 w-full h-[22%]"
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        fill={scene.hillsBack}
      >
        <path d="M0,55 C90,25 160,80 240,45 C320,15 360,60 400,35 L400,100 L0,100 Z" opacity="0.55" />
      </svg>
      <svg
        className="absolute bottom-0 left-0 w-full h-[15%]"
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        fill={scene.hills}
      >
        <path d="M0,65 C100,35 170,85 250,55 C330,25 365,70 400,50 L400,100 L0,100 Z" opacity="0.65" />
      </svg>

      {/* Soft wash so page content stays readable regardless of scene */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/55 via-bg/45 to-bg/70" />
    </div>
  );
}