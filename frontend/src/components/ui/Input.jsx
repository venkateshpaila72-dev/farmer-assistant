import { forwardRef } from "react";
import { cn } from "../../utils/cn";

export const Input = forwardRef(function Input(
  { label, error, className, id, ...props },
  ref
) {
  const inputId = id || props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "w-full rounded-sm border border-border bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-soft/60 transition-all duration-200 ease-out",
          "focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 focus:-translate-y-[1px]",
          error && "border-danger focus:ring-danger/10",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
});