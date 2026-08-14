import { Link } from "react-router-dom";
import { Leaf } from "lucide-react";
import { motion } from "framer-motion";
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

export function AuthLayout({ children, maxWidth = "max-w-md" }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-bg relative overflow-hidden">
      {/* Illustrated side panel — hidden on small screens so the form stays
          front and center on mobile, where there's no room to spare. Slides
          in from the left on mount; the form column (below) is timed to
          follow shortly after. */}
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.65, ease: easeOut }}
        className="hidden md:block md:w-[42%] lg:w-[38%] relative overflow-hidden"
      >
        <motion.img
          src="/login-illustration.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          animate={{ scale: [1.12, 1, 1.06, 1] }}
          transition={{
            duration: 24,
            times: [0, 0.06, 0.53, 1],
            repeat: Infinity,
            ease: easeOut,
          }}
        />
        {/* Soft fade at the top so the logo stays legible over the sky. */}
        <div className="absolute inset-0 bg-gradient-to-b from-bg/70 via-transparent to-transparent" />
        <div className="relative h-full flex flex-col justify-between p-8">
          <Link to="/">
            <Logo size="xs" />
          </Link>
        </div>
      </motion.div>

      <div className="flex-1 flex flex-col relative">
        {/* Greenery-themed animated backdrop for the form side: two slow,
            drifting green glows plus gently rising leaves. All decorative
            and non-interactive, sitting behind the actual form content. */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
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
              className="absolute bottom-[-40px] text-primary/20"
              style={{ left: leaf.left }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: "-110vh", opacity: [0, 1, 1, 0], rotate: [0, 25, -15, 10] }}
              transition={{
                duration: leaf.duration,
                delay: leaf.delay,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <Leaf size={leaf.size} />
            </motion.span>
          ))}
        </div>

        <div className="px-6 py-6 md:hidden relative">
          <Link to="/">
            <Logo size="xs" />
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 pb-16 w-full relative">
          <motion.div
            initial={{ opacity: 0, x: 36 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.3, ease: easeOut }}
            className={`w-full ${maxWidth}`}
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}