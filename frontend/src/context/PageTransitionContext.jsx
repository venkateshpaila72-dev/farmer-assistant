import { createContext, useContext, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAnimation, motion } from "framer-motion";

const PageTransitionContext = createContext(null);

/**
 * Wraps the whole app. Exposes `transitionTo(path)`, which plays a smooth
 * "slide up and fade" exit on whatever is currently on screen, THEN
 * navigates — so the outgoing page visibly leaves before the new route
 * takes over, instead of an instant hard cut.
 *
 * Every route change (however it happens — this transition, a normal
 * <Link>, back/forward, a redirect) also gets a soft rise-and-fade
 * entrance, so navigation feels consistent app-wide.
 */
export function PageTransitionProvider({ children }) {
  const controls = useAnimation();
  const navigate = useNavigate();
  const location = useLocation();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // New route just mounted underneath us — rise gently into place.
    controls.set({ y: 18, opacity: 0 });
    controls.start({ y: 0, opacity: 1, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } });
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  async function transitionTo(path, options) {
    await controls.start({
      y: "-6%",
      opacity: 0,
      transition: { duration: 0.45, ease: [0.7, 0, 0.84, 0] },
    });
    navigate(path, options);
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