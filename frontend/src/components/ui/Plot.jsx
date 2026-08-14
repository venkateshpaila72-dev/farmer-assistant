import { cn } from "../../utils/cn";

const tones = {
  soil: "bg-primary-tint text-primary",
  crop: "bg-accent-tint text-accent",
  info: "bg-sky-50 text-sky-700",
  ink: "bg-ink text-white",
  plain: "bg-surface text-ink border border-border",
};

// Hover variants: each quick-action gets its own solid brand color to swap
// to on hover, with white text — mirrors the reference design where
// hovering a card fills it with color instead of just lifting it. Opt-in
// via `hoverColor` so existing static uses (e.g. the landing page Features
// section) are unaffected.
const hoverTones = {
  soil: "hover:bg-primary hover:text-white hover:border-primary",
  crop: "hover:bg-accent hover:text-white hover:border-accent",
  info: "hover:bg-sky-600 hover:text-white hover:border-sky-600",
  ink: "hover:bg-ink",
  plain: "hover:bg-ink hover:text-white hover:border-ink",
};

export function Plot({ tone = "plain", hoverColor = false, className, children, ...props }) {
  return (
    <div
      className={cn(
        "rounded-md p-7 transition-all duration-300 ease-out-expo hover:-translate-y-1 hover:shadow-lg",
        tones[tone],
        hoverColor && hoverTones[tone],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}