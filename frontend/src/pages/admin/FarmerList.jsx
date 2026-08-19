import { useEffect, useMemo, useState } from "react";
import { Search, Pencil, Check, X } from "lucide-react";
import { toast } from "react-toastify";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";
import { getAllFarmers, updateFarmerPhone } from "../../api/admin";

// Inline phone editor for one row — a plain text field + save/cancel, not
// a modal (this project's Modal.jsx is an unfinished stub). Mirrors the
// click-to-edit pattern already used on the farmer's own Profile page.
function PhoneCell({ farmer, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(farmer.phone || "");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setValue(farmer.phone || "");
    setEditing(true);
  }

  async function save() {
    const trimmed = value.trim();
    if (trimmed === (farmer.phone || "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateFarmerPhone(farmer.username, trimmed);
      onSaved(farmer.username, trimmed);
      toast.success(`Phone number updated for ${farmer.username}`);
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't update phone number");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 group">
        <span>{farmer.phone || "—"}</span>
        <button
          type="button"
          onClick={startEdit}
          className="text-ink-soft hover:text-primary transition-colors duration-150 opacity-0 group-hover:opacity-100"
          aria-label={`Edit phone number for ${farmer.username}`}
        >
          <Pencil size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        disabled={saving}
        className="w-36 rounded-sm border border-primary bg-surface px-2 py-1 text-sm text-ink focus:outline-none"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="text-accent hover:text-accent-dark transition-colors duration-150 disabled:opacity-50"
        aria-label="Save"
      >
        <Check size={15} />
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={saving}
        className="text-ink-soft hover:text-danger transition-colors duration-150 disabled:opacity-50"
        aria-label="Cancel"
      >
        <X size={15} />
      </button>
    </div>
  );
}

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

  function handlePhoneSaved(username, newPhone) {
    setFarmers((prev) => prev.map((f) => (f.username === username ? { ...f, phone: newPhone } : f)));
  }

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
                  <td className="px-4 py-3 text-ink-soft">
                    <PhoneCell farmer={f} onSaved={handlePhoneSaved} />
                  </td>
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