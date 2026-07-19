import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sprout, LayoutDashboard, Leaf, ScanLine, LineChart, Newspaper, MessageSquare, User } from "lucide-react";
import { cn } from "../../utils/cn";

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
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:shrink-0 border-r border-border bg-surface">
      <div className="h-[68px] flex items-center gap-2.5 px-6 border-b border-border font-display font-bold text-lg text-ink">
        <span className="w-8 h-8 rounded-[9px] bg-primary flex items-center justify-center text-white shrink-0">
          <Sprout size={18} />
        </span>
        {t("brand.name")}
      </div>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {items.map(({ to, icon: Icon, key, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-sm text-[14.5px] font-medium transition-colors duration-150",
                isActive ? "bg-primary-tint text-primary" : "text-ink-soft hover:bg-bg hover:text-ink"
              )
            }
          >
            <Icon size={18} />
            {t(key)}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}