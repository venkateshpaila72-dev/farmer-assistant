import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Shield, Megaphone, UploadCloud } from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { getAnalytics } from "../../api/admin";

const quickLinks = [
  { to: "/admin/farmers", icon: Users, label: "Farmers" },
  { to: "/admin/announcements", icon: Megaphone, label: "Announcements" },
  { to: "/admin/market-upload", icon: UploadCloud, label: "Market Data" },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getAnalytics().then(setStats).catch(() => setError(true));
  }, []);

  return (
    <div className="p-5 md:p-8 flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Dashboard</h1>
        <p className="text-sm text-ink-soft mt-1">Platform overview.</p>
      </div>

      {error ? (
        <ErrorState message="Couldn't load dashboard stats." />
      ) : !stats ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <RevealOnScroll>
            <Panel className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-primary-tint text-primary flex items-center justify-center shrink-0">
                <Users size={20} />
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-ink">{stats.total_farmers}</div>
                <div className="text-sm text-ink-soft">Total farmers</div>
              </div>
            </Panel>
          </RevealOnScroll>
          <RevealOnScroll delay={0.05}>
            <Panel className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-accent-tint text-accent flex items-center justify-center shrink-0">
                <Shield size={20} />
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-ink">{stats.total_admins}</div>
                <div className="text-sm text-ink-soft">Total admins</div>
              </div>
            </Panel>
          </RevealOnScroll>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide mb-3">Quick actions</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {quickLinks.map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to}>
              <Panel className="p-5 flex items-center gap-3 hover:border-ink-soft transition-colors duration-150">
                <Icon size={18} className="text-primary shrink-0" />
                <span className="text-sm font-semibold text-ink">{label}</span>
              </Panel>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}