import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Leaf, ScanLine, MessageSquare, User } from "lucide-react";
import { cn } from "../../utils/cn";

const items = [
  { to: "/dashboard", icon: LayoutDashboard, key: "sidebar.dashboard", end: true },
  { to: "/crop-tools", icon: Leaf, key: "sidebar.cropTools" },
  { to: "/vision", icon: ScanLine, key: "sidebar.vision" },
  { to: "/chat", icon: MessageSquare, key: "sidebar.chat" },
  { to: "/profile", icon: User, key: "sidebar.profile" },
];

export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border flex items-stretch h-[64px]">
      {items.map(({ to, icon: Icon, key, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150",
              isActive ? "text-primary" : "text-ink-soft"
            )
          }
        >
          <Icon size={20} />
          {t(key)}
        </NavLink>
      ))}
    </nav>
  );
}