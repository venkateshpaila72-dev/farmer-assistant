import { cn } from "../../utils/cn";

export function Card({ className, children, ...props }) {
  return (
    <div className={cn("bg-surface border border-border rounded-md p-6", className)} {...props}>
      {children}
    </div>
  );
}