import { cn } from "../../utils/cn";

const tones = {
  soil: "bg-primary-tint text-primary",
  crop: "bg-accent-tint text-accent",
  ink: "bg-ink text-white",
  plain: "bg-surface text-ink border border-border",
};

export function Plot({ tone = "plain", className, children, ...props }) {
  return (
    <div
      className={cn(
        "rounded-md p-7 transition-transform duration-300 ease-out-expo hover:-translate-y-1",
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}