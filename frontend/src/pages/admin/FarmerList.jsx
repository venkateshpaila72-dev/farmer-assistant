import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";
import { getAllFarmers } from "../../api/admin";

export default function FarmerList() {
  const [farmers, setFarmers] = useState(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getAllFarmers()
      .then((data) => setFarmers(data.farmers || []))
      .catch(() => setError(true));
  }, []);

  const filtered = useMemo(() => {
    if (!farmers) return [];
    const q = search.trim().toLowerCase();
    if (!q) return farmers;
    return farmers.filter((f) =>
      [f.username, f.phone, f.village, f.city, f.state].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [farmers, search]);

  return (
    <div className="p-5 md:p-8 flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Farmers</h1>
        <p className="text-sm text-ink-soft mt-1">
          {farmers ? `${farmers.length} registered farmers.` : "Loading farmers..."}
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username, phone, or location..."
          className="w-full rounded-sm border border-border bg-surface pl-9 pr-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-primary focus:outline-none transition-colors duration-150"
        />
      </div>

      {error ? (
        <ErrorState message="Couldn't load the farmer list." />
      ) : !farmers ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No farmers match your search." />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-semibold">Username</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.username} className="border-b border-border last:border-0 hover:bg-bg transition-colors duration-100">
                  <td className="px-4 py-3 font-medium text-ink">{f.username}</td>
                  <td className="px-4 py-3 text-ink-soft">{f.phone || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {[f.village, f.city, f.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {f.created_at ? new Date(f.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}