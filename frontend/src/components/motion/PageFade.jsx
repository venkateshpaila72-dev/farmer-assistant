import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";

const easeOut = [0.16, 1, 0.3, 1];

/**
 * Wraps routed page CONTENT ONLY — never a layout's sidebar/topbar/nav.
 * Crossfades the new page in as the old one fades out, keyed by the
 * top-level section of the path (e.g. "/crop-tools" for both
 * "/crop-tools" and "/crop-tools/fertilizer"), so:
 *   - switching sections (Dashboard → Crop Tools) crossfades smoothly
 *   - switching sub-tabs within a section (Fertilizer → Yield) doesn't
 *     needlessly re-trigger the whole transition
 *
 * Deliberately does NOT use AnimatePresence's `mode="wait"` — that mode
 * fully finishes the exit animation before the enter animation even
 * starts, which leaves a blank gap and then makes the new content pop in
 * all at once (reads as a "refresh"). The default overlapping mode lets
 * the two cross-fade into each other instead.
 *
 * Usage: wrap only the `{children}`/`<Outlet/>` slot inside a persistent
 * layout, e.g.:
 *
 *   <Sidebar />
 *   <main>
 *     <PageFade><Topbar />{children}</PageFade>   // WRONG — Topbar re-animates
 *     <PageFade>{children}</PageFade>              // RIGHT — only page content
 *   </main>
 */
export function PageFade({ children }) {
  const location = useLocation();
  const section = location.pathname.split("/")[1] || "root";

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={section}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: easeOut }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}