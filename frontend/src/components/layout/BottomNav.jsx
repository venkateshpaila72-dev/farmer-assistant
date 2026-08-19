import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";
import { usePageTransition } from "../../context/PageTransitionContext";
import iconDashboard from "../../assets/nav-icons/dashboard.png";
import iconCropTools from "../../assets/nav-icons/crop-tools.png";
import iconPhotoCheck from "../../assets/nav-icons/photo-check.png";
import iconChat from "../../assets/nav-icons/chat.png";
import iconProfile from "../../assets/nav-icons/profile.png";

const items = [
  { to: "/dashboard", icon: iconDashboard, key: "sidebar.dashboard", end: true },
  { to: "/crop-tools", icon: iconCropTools, key: "sidebar.cropTools" },
  { to: "/vision", icon: iconPhotoCheck, key: "sidebar.vision" },
  { to: "/chat", icon: iconChat, key: "sidebar.chat" },
  { to: "/profile", icon: iconProfile, key: "sidebar.profile" },
];

export function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const { transitionTo } = usePageTransition();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/40 backdrop-blur-lg border-t border-border/40 flex items-stretch h-[64px]">
      {items.map(({ to, icon, key, end }) => {
        const isActive = end ? location.pathname === to : location.pathname.startsWith(to);
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={(e) => {
              if (isActive) return;
              e.preventDefault();
              transitionTo(to);
            }}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150",
              isActive ? "text-primary" : "text-ink-soft"
            )}
          >
            <img src={icon} alt="" className="w-6 h-6 object-contain" />
            {t(key)}
          </NavLink>
        );
      })}
    </nav>
  );
}