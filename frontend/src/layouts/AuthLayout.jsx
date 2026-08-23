import { Link } from "react-router-dom";
import { useRef } from "react";
import { Leaf } from "lucide-react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { Logo } from "../components/ui/Logo";

const easeOut = [0.16, 1, 0.3, 1];

// A handful of soft leaf shapes that drift upward and sway, looping
// forever, at staggered speeds/delays so the motion never feels mechanical.
const FLOATING_LEAVES = [
  { left: "8%", size: 22, duration: 14, delay: 0 },
  { left: "22%", size: 16, duration: 18, delay: 3 },
  { left: "40%", size: 26, duration: 16, delay: 1.2 },
  { left: "58%", size: 18, duration: 20, delay: 5 },
  { left: "74%", size: 24, duration: 15, delay: 2.4 },
  { left: "88%", size: 17, duration: 19, delay: 4.2 },
];

/**
 * Auth side panel, in two flavors:
 *   - "scene": a single self-contained illustration (sky/field baked in)
 *     filling the whole panel — used on Login.
 *   - "split": a flat peach-over-green backdrop we draw ourselves, with a
 *     transparent-background illustration composited on top, bottom
 *     anchored — used on Register / Admin login.
 *
 * `screenGlow` (optional) is a {left, top, width, height} box in percent,
 * pointing at the phone/tablet screen inside the illustration. When given,
 * a soft glow sits over that exact spot: it breathes gently on its own,
 * and brightens further while `formFocused` is true — a small live-feeling
 * link between "the app on screen" and "the form you're filling in".
 */
export function AuthLayout({
  children,
  maxWidth = "max-w-md",
  illustrationSrc,
  illustrationAlt,
  illustrationNode,
  panelVariant = "scene",
  screenGlow,
  formFocused = false,
}) {
  const panelRef = useRef(null);

  // Gentle cursor-parallax on the illustration — moves a few px opposite
  // the pointer so the scene reads as having depth. Springs smooth it out
  // so it never feels twitchy; resets to center when the pointer leaves.
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const springX = useSpring(rawX, { stiffness: 60, damping: 18, mass: 0.6 });
  const springY = useSpring(rawY, { stiffness: 60, damping: 18, mass: 0.6 });

  function handlePointerMove(e) {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    rawX.set(relX * -10);
    rawY.set(relY * -8);
  }

  function handlePointerLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: easeOut }}
      className="min-h-screen flex flex-col md:flex-row bg-bg relative overflow-hidden"
    >
      {/* Illustrated side panel — hidden on small screens so the form stays
          front and center on mobile, where there's no room to spare. */}
      <div
        ref={panelRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={`hidden md:block md:w-[42%] lg:w-[38%] relative overflow-hidden ${
          panelVariant === "split" ? "bg-bg" : "bg-white"
        }`}
      >
        {panelVariant === "split" && (
          // Flat two-tone backdrop, drawn ourselves — the illustration
          // (transparent background) sits on top of this.
          <div className="absolute inset-0" aria-hidden="true">
            <div className="absolute inset-x-0 top-0 h-[46%] bg-primary-tint" />
            <div className="absolute inset-x-0 bottom-0 h-[54%] bg-accent-tint" />
            <motion.div
              className="absolute rounded-full bg-gold"
              style={{ top: "9%", right: "16%", width: "13%", aspectRatio: "1/1" }}
              animate={{ opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        )}

        {illustrationNode ? (
          // Custom illustration content (e.g. a per-step onboarding scene
          // that crossfades internally) — still gets the same parallax.
          <motion.div
            className="absolute bottom-0 inset-x-0 mx-auto w-[92%] h-full"
            style={{ x: springX, y: springY }}
          >
            {illustrationNode}
          </motion.div>
        ) : (
          <motion.img
            src={illustrationSrc}
            alt={illustrationAlt || ""}
            role={illustrationAlt ? "img" : "presentation"}
            className={
              panelVariant === "split"
                ? "absolute bottom-0 inset-x-0 mx-auto w-[92%] max-w-none object-contain"
                : "absolute inset-0 w-full h-full object-cover"
            }
            style={{ x: springX, y: springY }}
            initial={{ opacity: 0, scale: panelVariant === "split" ? 1.04 : 1.1 }}
            animate={{ opacity: 1, scale: panelVariant === "split" ? [1.04, 1, 1.02, 1] : [1.1, 1, 1.05, 1] }}
            transition={{
              opacity: { duration: 0.5, ease: easeOut },
              scale: {
                duration: panelVariant === "split" ? 20 : 24,
                times: [0, 0.06, 0.53, 1],
                repeat: Infinity,
                ease: easeOut,
              },
            }}
          />
        )}

        {/* Soft glow over the phone/tablet screen in the artwork — idles
            on its own, brightens while the form has focus. Purely
            decorative, so it's hidden from assistive tech. */}
        {screenGlow && (
          <motion.div
            aria-hidden="true"
            className="absolute rounded-2xl pointer-events-none"
            style={{
              left: screenGlow.left,
              top: screenGlow.top,
              width: screenGlow.width,
              height: screenGlow.height,
              background: "radial-gradient(circle, rgba(180,134,11,0.55) 0%, rgba(15,81,50,0.0) 72%)",
            }}
            animate={
              formFocused
                ? { opacity: [0.55, 0.85, 0.55], scale: [1, 1.08, 1] }
                : { opacity: [0.18, 0.34, 0.18], scale: [1, 1.03, 1] }
            }
            transition={{
              duration: formFocused ? 1.6 : 4.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}

        {/* Soft fade at the top so the logo stays legible over the sky. */}
        <div className="absolute inset-0 bg-gradient-to-b from-bg/70 via-transparent to-transparent" aria-hidden="true" />
        <div className="relative h-full flex flex-col justify-between p-8">
          <Link
            to="/"
            className="w-fit rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Logo size="xs" />
          </Link>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative">
        {/* Greenery-themed animated backdrop for the form side: two slow,
            drifting green glows plus gently rising leaves. All decorative
            and non-interactive, sitting behind the actual form content. */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <motion.div
            className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-primary/15 blur-3xl"
            animate={{ x: [0, -30, 0], y: [0, 24, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-[-140px] left-[-100px] w-[380px] h-[380px] rounded-full bg-emerald-500/10 blur-3xl"
            animate={{ x: [0, 26, 0], y: [0, -20, 0] }}
            transition={{ duration: 19, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          />
          {FLOATING_LEAVES.map((leaf, i) => (
            <motion.span
              key={i}
              className="absolute bottom-[-40px] text-accent/70"
              style={{ left: leaf.left }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: "-110vh", opacity: [0, 0.7, 0.7, 0], rotate: [0, 25, -15, 10] }}
              transition={{
                duration: leaf.duration,
                delay: leaf.delay,
                times: [0, 0.22, 0.78, 1],
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <Leaf size={leaf.size} strokeWidth={2.25} />
            </motion.span>
          ))}
        </div>

        <div className="px-6 py-6 md:hidden relative">
          <Link
            to="/"
            className="w-fit rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 inline-block"
          >
            <Logo size="xs" />
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 pb-16 w-full relative">
          <div className={`w-full ${maxWidth}`}>{children}</div>
        </div>
      </div>
    </motion.div>
  );
}