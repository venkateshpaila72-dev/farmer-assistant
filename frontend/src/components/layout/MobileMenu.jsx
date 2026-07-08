import { AnimatePresence, motion } from "framer-motion";

const easeOut = [0.16, 1, 0.3, 1];

export function MobileMenu({ open, onClose, links }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: easeOut }}
          className="md:hidden overflow-hidden border-b border-border bg-bg"
        >
          <div className="flex flex-col px-6 py-3">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={onClose}
                className="py-2.5 text-[15px] font-medium text-ink-soft border-b border-border last:border-none"
              >
                {l.label}
              </a>
            ))}
            <a href="/login" onClick={onClose} className="py-2.5 text-[15px] font-medium text-ink-soft">
              Log in
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}