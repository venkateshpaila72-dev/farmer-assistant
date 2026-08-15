import { cn } from "../../utils/cn";

export function Panel({ className, children, ...props }) {
  return (
    <div className={cn("bg-surface border border-border rounded-md shadow-[0_1px_2px_rgba(42,33,20,0.04),0_8px_24px_-12px_rgba(42,33,20,0.12)]", className)} {...props}>
      {children}
    </div>
  );
}