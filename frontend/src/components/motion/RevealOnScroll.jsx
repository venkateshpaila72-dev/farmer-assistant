import { motion } from "framer-motion";

const easeOut = [0.16, 1, 0.3, 1];

export function RevealOnScroll({ children, delay = 0, className, as = "div", once = true, ...props }) {
  const Component = motion[as] || motion.div;
  return (
    <Component
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.15, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.55, delay, ease: easeOut }}
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
}