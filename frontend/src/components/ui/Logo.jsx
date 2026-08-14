import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";

const sizes = {
  xs: { img: "w-7 h-7", text: "text-base" },
  sm: { img: "w-8 h-8", text: "text-lg" },
  md: { img: "w-11 h-11", text: "text-xl" },
  lg: { img: "w-20 h-20", text: "text-2xl" },
  xl: { img: "w-32 h-32", text: "text-3xl" },
};

/**
 * The Kisan Sahayak brand mark. Used everywhere the old Sprout-icon badge
 * used to appear (navbar, sidebars, auth panels, loading screen) so the
 * whole app shows one consistent logo.
 */
export function Logo({ size = "sm", showText = true, showTagline = false, className, imgClassName, textClassName }) {
  const { t } = useTranslation();
  const s = sizes[size] || sizes.sm;

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src="/logo.png"
        alt={t("brand.name")}
        className={cn(s.img, "shrink-0 object-contain", imgClassName)}
      />
      {showText && (
        <span className="flex flex-col leading-tight">
          <span className={cn("font-display font-bold text-ink", s.text, textClassName)}>
            {t("brand.name")}
          </span>
          {showTagline && (
            <span className="text-[11.5px] font-medium text-ink-soft tracking-wide">{t("brand.tagline")}</span>
          )}
        </span>
      )}
    </span>
  );
}