import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";
import { Logo } from "../ui/Logo";
import iconDashboard from "../../assets/nav-icons/dashboard.png";
import iconCropTools from "../../assets/nav-icons/crop-tools.png";
import iconPhotoCheck from "../../assets/nav-icons/photo-check.png";
import iconMarket from "../../assets/nav-icons/market.png";
import iconNews from "../../assets/nav-icons/news.png";
import iconChat from "../../assets/nav-icons/chat.png";
import iconProfile from "../../assets/nav-icons/profile.png";

const items = [
  { to: "/dashboard", icon: iconDashboard, key: "sidebar.dashboard", end: true },
  { to: "/crop-tools", icon: iconCropTools, key: "sidebar.cropTools" },
  { to: "/vision", icon: iconPhotoCheck, key: "sidebar.vision" },
  { to: "/market", icon: iconMarket, key: "sidebar.market" },
  { to: "/news", icon: iconNews, key: "sidebar.news" },
  { to: "/chat", icon: iconChat, key: "sidebar.chat" },
  { to: "/profile", icon: iconProfile, key: "sidebar.profile" },
];

export function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:shrink-0 border-r border-border/40 bg-surface/25 backdrop-blur-lg">
      <div className="h-[68px] flex items-center px-6 border-b border-border">
        <Logo size="sm" showTagline />
      </div>
      <nav className="flex-1 px-3 py-5 flex flex-col gap-1">
        {items.map(({ to, icon, key, end }) => {
          const isActive = end ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={cn(
                "relative flex items-center gap-3 px-3.5 py-2.5 rounded-md text-[14.5px] font-medium transition-colors duration-200",
                isActive ? "text-white" : "text-ink-soft hover:bg-accent-tint hover:text-accent"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-pill"
                  className="absolute inset-0 rounded-md bg-accent shadow-sm shadow-accent/30"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <img src={icon} alt="" className="relative w-6 h-6 object-contain shrink-0" />
              <span className="relative">{t(key)}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}