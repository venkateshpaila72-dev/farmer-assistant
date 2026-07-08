import { AlertTriangle } from "lucide-react";
import { cn } from "../../utils/cn";

export function AlertBanner({ children, className }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-sm bg-danger-tint text-danger px-3 py-2.5 text-sm font-semibold", className)}>
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      {children}
    </div>
  );
}