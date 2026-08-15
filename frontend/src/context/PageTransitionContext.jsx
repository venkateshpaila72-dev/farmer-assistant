import { createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useAnimation, motion } from "framer-motion";

const PageTransitionContext = createContext(null);

/**
 * Wraps the whole app. Exposes `transitionTo(path)`, which plays a smooth
 * "slide up and fade" exit on whatever is currently on screen, THEN
 * navigates — so the outgoing page visibly leaves before the new route
 * takes over, instead of an instant hard cut. Use this ONLY for deliberate,
 * full-page handoffs (e.g. landing page → login) where the entire screen
 * is meant to change.
 *
 * This provider intentionally does NOT animate on every route change.
 * An earlier version did (a rise-and-fade on every navigation), but since
 * this wraps the whole app — persistent chrome like the dashboard sidebar
 * and topbar included — that meant the sidebar visibly dropped and faded
 * on every single in-app navigation, which read as broken rather than
 * smooth. Per-page content transitions now live in <PageFade>, scoped to
 * just the content area inside each layout, so persistent chrome never
 * moves. See components/motion/PageFade.jsx.
 */
export function PageTransitionProvider({ children }) {
  const controls = useAnimation();
  const navigate = useNavigate();

  async function transitionTo(path, options) {
    await controls.start({
      y: "-6%",
      opacity: 0,
      transition: { duration: 0.45, ease: [0.7, 0, 0.84, 0] },
    });
    navigate(path, options);
    // Reset for the next mount — the page that just mounted underneath
    // should simply be visible, not re-trigger any animation.
    controls.set({ y: 0, opacity: 1 });
  }

  return (
    <PageTransitionContext.Provider value={{ transitionTo }}>
      <motion.div animate={controls} initial={{ y: 0, opacity: 1 }}>
        {children}
      </motion.div>
    </PageTransitionContext.Provider>
  );
}

export function usePageTransition() {
  const ctx = useContext(PageTransitionContext);
  if (!ctx) throw new Error("usePageTransition must be used within PageTransitionProvider");
  return ctx;
}