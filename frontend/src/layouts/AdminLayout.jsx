import { NavLink, useNavigate } from "react-router-dom";
import { Sprout, LayoutDashboard, Users, BarChart3, Megaphone, UploadCloud, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { cn } from "../utils/cn";

// Denser than the farmer-facing DashboardLayout, per the design doc — same
// tokens/type system, table-driven information density instead of cards.
// English-only, no i18n — this is an internal staff tool, not farmer-facing.
const items = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/farmers", icon: Users, label: "Farmers" },
  { to: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/admin/announcements", icon: Megaphone, label: "Announcements" },
  { to: "/admin/market-upload", icon: UploadCloud, label: "Market Data" },
];

export function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-bg md:flex">
      <aside className="hidden md:flex md:w-56 md:flex-col md:shrink-0 border-r border-border bg-surface">
        <div className="h-[60px] flex items-center gap-2.5 px-5 border-b border-border font-display font-bold text-base text-ink">
          <span className="w-7 h-7 rounded-[8px] bg-primary flex items-center justify-center text-white shrink-0">
            <Sprout size={16} />
          </span>
          Kisan Sahayak
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft bg-bg px-1.5 py-0.5 rounded-sm ml-auto">
            ADMIN
          </span>
        </div>
        <nav className="flex-1 px-2.5 py-3 flex flex-col gap-0.5">
          {items.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-sm text-[13.5px] font-medium transition-colors duration-150",
                  isActive ? "bg-primary-tint text-primary" : "text-ink-soft hover:bg-bg hover:text-ink"
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2.5 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-[13.5px] font-medium text-ink-soft hover:bg-bg hover:text-danger transition-colors duration-150"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[60px] flex items-center justify-between gap-4 px-5 border-b border-border bg-surface">
          <p className="text-sm text-ink-soft truncate">Hi, {user?.username || "Admin"}</p>
          <button
            onClick={handleLogout}
            className="md:hidden flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-danger transition-colors duration-150"
          >
            <LogOut size={16} /> Log out
          </button>
        </header>

        {/* Mobile nav — a simple scrollable tab row instead of a sidebar */}
        <nav className="md:hidden flex items-center gap-1 px-3 py-2 border-b border-border bg-surface overflow-x-auto">
          {items.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[13px] font-medium whitespace-nowrap transition-colors duration-150",
                  isActive ? "bg-primary-tint text-primary" : "text-ink-soft hover:bg-bg hover:text-ink"
                )
              }
            >
              <Icon size={14} />
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}