import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Leaf } from "lucide-react";

const easeOut = [0.16, 1, 0.3, 1];

const FLOATING_LEAVES = [
  { left: "6%", size: 20, duration: 7, delay: 0 },
  { left: "18%", size: 15, duration: 9, delay: 1.1 },
  { left: "32%", size: 22, duration: 8, delay: 0.4 },
  { left: "50%", size: 16, duration: 10, delay: 1.8 },
  { left: "66%", size: 24, duration: 7.5, delay: 0.8 },
  { left: "80%", size: 17, duration: 9.5, delay: 1.5 },
  { left: "92%", size: 20, duration: 8.5, delay: 0.2 },
];

function titleCase(name) {
  if (!name) return "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Full-screen "Welcome back, {name}" moment shown right after a successful
 * login, before handing off to the real dashboard. Purely presentational —
 * the parent decides how long to keep it mounted and what happens after
 * (`onComplete`), so it composes cleanly with the existing page-transition
 * (slide up + fade) used everywhere else in the app.
 */
export function WelcomeOverlay({ name, onComplete, holdMs = 1900 }) {
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setTimeout(() => onComplete?.(), holdMs);
    return () => clearTimeout(timer);
  }, [onComplete, holdMs]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#f4f8ee] via-[#eaf3df] to-[#dcedc6]"
      >
        {/* Drifting green glows, same visual language as the auth screens. */}
        <motion.div
          className="absolute -top-24 -left-16 w-[420px] h-[420px] rounded-full bg-primary/20 blur-3xl"
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-160px] right-[-100px] w-[420px] h-[420px] rounded-full bg-emerald-500/20 blur-3xl"
          animate={{ x: [0, -24, 0], y: [0, -18, 0] }}
          transition={{ duration: 17, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />

        {/* Rolling field silhouette along the bottom for a bit of place. */}
        <svg
          className="absolute bottom-0 left-0 w-full h-[30%] text-primary/15"
          viewBox="0 0 400 100"
          preserveAspectRatio="none"
          fill="currentColor"
        >
          <path d="M0,60 C80,20 140,90 220,50 C300,15 340,70 400,40 L400,100 L0,100 Z" />
        </svg>
        <svg
          className="absolute bottom-0 left-0 w-full h-[20%] text-primary/25"
          viewBox="0 0 400 100"
          preserveAspectRatio="none"
          fill="currentColor"
        >
          <path d="M0,70 C90,40 160,95 240,60 C320,30 360,80 400,55 L400,100 L0,100 Z" />
        </svg>

        {/* Gently rising leaves. */}
        <div className="absolute inset-0 pointer-events-none">
          {FLOATING_LEAVES.map((leaf, i) => (
            <motion.span
              key={i}
              className="absolute bottom-[-40px] text-primary/30"
              style={{ left: leaf.left }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: "-110vh", opacity: [0, 1, 1, 0], rotate: [0, 20, -12, 8] }}
              transition={{ duration: leaf.duration, delay: leaf.delay, repeat: Infinity, ease: "linear" }}
            >
              <Leaf size={leaf.size} />
            </motion.span>
          ))}
        </div>

        {/* The moment itself: logo, then name, then subtitle — staggered. */}
        <div className="relative flex flex-col items-center text-center px-6">
          <motion.img
            src="/logo.png"
            alt=""
            className="w-28 h-28 md:w-32 md:h-32 object-contain drop-shadow-lg"
            initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: 0.6, ease: easeOut }}
          />
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35, ease: easeOut }}
            className="mt-6 font-display font-bold text-3xl md:text-4xl text-ink"
          >
            {t("welcome.title", { name: titleCase(name) })}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55, ease: easeOut }}
            className="mt-2 text-ink-soft text-sm md:text-base"
          >
            {t("welcome.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.85 }}
            className="mt-7 flex items-center gap-1.5"
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-primary/60"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}