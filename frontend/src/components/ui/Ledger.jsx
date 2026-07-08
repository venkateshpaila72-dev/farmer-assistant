import { cn } from "../../utils/cn";

export function Ledger({ children, className }) {
  return <div className={cn("divide-y divide-border", className)}>{children}</div>;
}

export function LedgerRow({ icon: Icon, label, value, tone = "default" }) {
  const valueTone = { default: "text-ink", up: "text-accent", down: "text-danger" }[tone];
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <span className="flex items-center gap-2.5 text-sm text-ink-soft">
        {Icon && <Icon size={16} className="text-ink-soft" />}
        {label}
      </span>
      <span className={cn("text-sm font-semibold", valueTone)}>{value}</span>
    </div>
  );
}