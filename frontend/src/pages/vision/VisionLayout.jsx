import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Bug, Layers, History } from "lucide-react";
import { cn } from "../../utils/cn";

const tabs = [
  { to: "/vision", key: "vision.tabDisease", icon: Bug, end: true },
  { to: "/vision/soil", key: "vision.tabSoil", icon: Layers },
  { to: "/vision/history", key: "vision.tabHistory", icon: History },
];

export default function VisionLayout() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-6 md:py-10">
      <h1 className="text-2xl mb-1">{t("vision.title")}</h1>
      <p className="text-ink-soft text-sm mb-6">{t("vision.subtitle")}</p>

      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map((tab) => {
          const isActive = tab.end ? location.pathname === tab.to : location.pathname.startsWith(tab.to);
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={cn(
                "relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors duration-150",
                isActive ? "text-primary" : "text-ink-soft hover:text-ink"
              )}
            >
              <tab.icon size={15} />
              {t(tab.key)}
              {isActive && (
                <motion.span
                  layoutId="vision-tab-indicator"
                  className="absolute left-0 right-0 -bottom-px h-[2px] bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
            </NavLink>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}