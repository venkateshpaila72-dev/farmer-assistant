import { motion } from "framer-motion";

const easeOut = [0.16, 1, 0.3, 1];

export function FadeUp({ children, delay = 0, className, as = "div", ...props }) {
  const Component = motion[as] || motion.div;
  return (
    <Component
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: easeOut }}
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
}