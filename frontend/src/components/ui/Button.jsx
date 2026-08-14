import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check } from "lucide-react";
import { cn } from "../../utils/cn";

const variants = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  ghost: "bg-transparent text-ink border border-border hover:border-ink-soft",
};

export function Button({ variant = "primary", className, children, loading = false, success = false, disabled, ...props }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      disabled={disabled || loading || success}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 rounded-sm px-5 py-2.5 text-sm font-semibold transition-colors duration-200 ease-out-expo disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
      {...props}
    >
      {/* Reserve the button's natural size with an invisible copy of the
          label, so swapping in the spinner/check never changes the button
          width or causes layout jump — only a smooth crossfade happens. */}
      <span className="invisible flex items-center gap-2">{children}</span>
      <span className="absolute inset-0 flex items-center justify-center gap-2">
        <AnimatePresence mode="wait" initial={false}>
          {success ? (
            <motion.span
              key="success"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="inline-flex items-center gap-2"
            >
              <Check size={16} />
            </motion.span>
          ) : loading ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.18 }}
              className="inline-flex items-center gap-2"
            >
              <Loader2 size={16} className="animate-spin" />
            </motion.span>
          ) : (
            <motion.span
              key="content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="inline-flex items-center gap-2"
            >
              {children}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  );
}