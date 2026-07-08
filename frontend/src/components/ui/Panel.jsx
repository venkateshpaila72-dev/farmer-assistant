import { cn } from "../../utils/cn";

export function Panel({ className, children, ...props }) {
  return (
    <div className={cn("bg-surface border border-border rounded-md", className)} {...props}>
      {children}
    </div>
  );
}