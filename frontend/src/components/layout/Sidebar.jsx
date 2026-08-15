import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { LayoutDashboard, Leaf, ScanLine, LineChart, Newspaper, MessageSquare, User } from "lucide-react";
import { cn } from "../../utils/cn";
import { Logo } from "../ui/Logo";

const items = [
  { to: "/dashboard", icon: LayoutDashboard, key: "sidebar.dashboard", end: true },
  { to: "/crop-tools", icon: Leaf, key: "sidebar.cropTools" },
  { to: "/vision", icon: ScanLine, key: "sidebar.vision" },
  { to: "/market", icon: LineChart, key: "sidebar.market" },
  { to: "/news", icon: Newspaper, key: "sidebar.news" },
  { to: "/chat", icon: MessageSquare, key: "sidebar.chat" },
  { to: "/profile", icon: User, key: "sidebar.profile" },
];

export function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:shrink-0 border-r border-border bg-gradient-to-b from-surface to-bg/40">
      <div className="h-[68px] flex items-center px-6 border-b border-border">
        <Logo size="sm" showTagline />
      </div>
      <nav className="flex-1 px-3 py-5 flex flex-col gap-1">
        {items.map(({ to, icon: Icon, key, end }) => {
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
              <Icon size={18} className="relative" />
              <span className="relative">{t(key)}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}