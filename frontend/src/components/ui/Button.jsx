import { cn } from "../../utils/cn";

const variants = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  ghost: "bg-transparent text-ink border border-border hover:border-ink-soft",
};

export function Button({ variant = "primary", className, children, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-sm px-5 py-2.5 text-sm font-semibold transition-all duration-200 ease-out-expo active:scale-[0.97] hover:-translate-y-px",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}