import { useEffect, useMemo, useState } from "react";
import { Users, Shield } from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { getAnalytics, getAllFarmers } from "../../api/admin";

// The backend's /admin/analytics only returns two raw counts (total
// farmers, total admins) — there's no dedicated analytics aggregation
// endpoint yet. The state-by-state breakdown below is computed client-side
// from the real farmer list (/admin/all-farmers) rather than inventing
// numbers, so what's shown here is honest even though it's more limited
// than a full analytics dashboard would be.
export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [farmers, setFarmers] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([getAnalytics(), getAllFarmers()])
      .then(([a, f]) => {
        setStats(a);
        setFarmers(f.farmers || []);
      })
      .catch(() => setError(true));
  }, []);

  const byState = useMemo(() => {
    if (!farmers) return [];
    const counts = {};
    for (const f of farmers) {
      const key = f.state || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [farmers]);

  if (error) {
    return (
      <div className="p-5 md:p-8">
        <ErrorState message="Couldn't load analytics." />
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Analytics</h1>
        <p className="text-sm text-ink-soft mt-1">Platform usage stats.</p>
      </div>

      {!stats || !farmers ? (
        <div className="flex flex-col gap-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <Panel className="p-5 flex items-center gap-4">
              <Users size={20} className="text-primary shrink-0" />
              <div>
                <div className="text-2xl font-display font-bold text-ink">{stats.total_farmers}</div>
                <div className="text-sm text-ink-soft">Total farmers</div>
              </div>
            </Panel>
            <Panel className="p-5 flex items-center gap-4">
              <Shield size={20} className="text-accent shrink-0" />
              <div>
                <div className="text-2xl font-display font-bold text-ink">{stats.total_admins}</div>
                <div className="text-sm text-ink-soft">Total admins</div>
              </div>
            </Panel>
          </div>

          <Panel className="p-5">
            <h2 className="text-sm font-semibold text-ink mb-1">Farmers by state</h2>
            <p className="text-xs text-ink-soft mb-4">Computed from the current farmer list.</p>
            <div className="flex flex-col gap-2">
              {byState.map(([state, count]) => {
                const pct = Math.round((count / farmers.length) * 100);
                return (
                  <div key={state} className="flex items-center gap-3">
                    <span className="text-sm text-ink w-32 shrink-0 truncate">{state}</span>
                    <div className="flex-1 h-2 rounded-full bg-bg overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm text-ink-soft w-10 text-right shrink-0">{count}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}