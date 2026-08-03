import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { UploadCloud, FileText, RefreshCw, Zap } from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { uploadMarketDataset, getMarketRecords, getAvailableStates, runMarketSync } from "../../api/market";

export default function MarketDataUpload() {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const [states, setStates] = useState([]);
  const [recordsState, setRecordsState] = useState("");
  const [records, setRecords] = useState(null);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    getAvailableStates()
      .then((data) => setStates(data.states || []))
      .catch(() => {});
  }, []);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    setUploadResult(null);
    if (f && !f.name.endsWith(".csv")) {
      toast.error("Only CSV files are allowed.");
      return;
    }
    setFile(f || null);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadMarketDataset(file);
      setUploadResult(result);
      toast.success("Upload started — processing in the background.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  // Same job the scheduler runs automatically at 5 AM — pulls live
  // AGMARKNET prices right now instead of waiting for the schedule.
  async function handleRunSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await runMarketSync();
      setSyncResult(result);
      toast.success(`Sync complete — ${result.states_synced} state(s) synced.`);
      getAvailableStates().then((d) => setStates(d.states || [])).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.detail || "Sync failed. Try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function loadRecords(stateFilter, skip = 0) {
    setLoadingRecords(true);
    try {
      const data = await getMarketRecords({ state: stateFilter || undefined, limit: 20, skip });
      setRecords(skip === 0 ? data.records : [...(records || []), ...data.records]);
      setRecordsTotal(data.total);
    } catch {
      toast.error("Couldn't load records.");
    } finally {
      setLoadingRecords(false);
    }
  }

  useEffect(() => {
    loadRecords(recordsState, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsState]);

  return (
    <div className="p-5 md:p-8 flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Market Data Upload</h1>
        <p className="text-sm text-ink-soft mt-1">Sync live AGMARKNET prices, or upload a CSV directly.</p>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
        {/* Browse records — on the left, the primary view */}
        <Panel className="p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">Browse records</h2>
              <p className="text-xs text-ink-soft mt-0.5">
                {recordsTotal > 0 ? `${recordsTotal} records in the database` : "See what's actually in the database."}
              </p>
            </div>
            <Select value={recordsState} onChange={(e) => setRecordsState(e.target.value)} className="w-48">
              <option value="">All states</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>

          {loadingRecords && !records ? (
            <p className="text-sm text-ink-soft">Loading...</p>
          ) : records && records.length === 0 ? (
            <p className="text-sm text-ink-soft">No records found.</p>
          ) : records ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-3 py-2 font-semibold">Commodity</th>
                    <th className="px-3 py-2 font-semibold">Market</th>
                    <th className="px-3 py-2 font-semibold">State</th>
                    <th className="px-3 py-2 font-semibold">Modal price</th>
                    <th className="px-3 py-2 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium text-ink">{r.commodity_raw}</td>
                      <td className="px-3 py-2 text-ink-soft">{r.market}, {r.district}</td>
                      <td className="px-3 py-2 text-ink-soft">{r.state}</td>
                      <td className="px-3 py-2 text-ink-soft">₹{r.modal_price}</td>
                      <td className="px-3 py-2 text-ink-soft">{r.arrival_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {records.length < recordsTotal && (
                <button
                  type="button"
                  onClick={() => loadRecords(recordsState, records.length)}
                  disabled={loadingRecords}
                  className="mt-3 text-sm font-semibold text-primary hover:text-primary-dark disabled:opacity-50"
                >
                  {loadingRecords ? "Loading..." : `Load more (${records.length} of ${recordsTotal})`}
                </button>
              )}
            </div>
          ) : null}
        </Panel>

        {/* Sync + upload controls, on the right */}
        <div className="flex flex-col gap-5">
          <Panel className="p-5">
            <h2 className="text-sm font-semibold text-ink flex items-center gap-1.5 mb-1">
              <Zap size={15} className="text-primary" /> Run market sync now
            </h2>
            <p className="text-xs text-ink-soft mb-4">
              Pulls live AGMARKNET prices right now — the same job that runs automatically every day at 5 AM.
            </p>
            <Button type="button" onClick={handleRunSync} disabled={syncing} className="w-full sm:w-auto">
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Run sync now"}
            </Button>
            {syncResult && (
              <div className="mt-4 p-3 rounded-sm bg-accent-tint border border-accent/30 text-sm text-ink">
                <p><span className="font-semibold">{syncResult.states_synced}</span> state(s) synced</p>
                {syncResult.states_failed > 0 && (
                  <p className="text-danger mt-0.5">{syncResult.states_failed} state(s) failed</p>
                )}
              </div>
            )}
          </Panel>

          <Panel className="p-5">
            <h2 className="text-sm font-semibold text-ink mb-1">Upload a CSV instead</h2>
            <p className="text-xs text-ink-soft mb-4">
              Expected columns: Arrival_Date, Commodity, Commodity_Code, District, Grade, Market, Max_Price, Min_Price, Modal_Price, State, Variety
            </p>

            <label
              htmlFor="csv-upload"
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-md py-8 px-4 text-center cursor-pointer transition-colors duration-150 hover:border-primary hover:bg-primary-tint/40"
            >
              <span className="w-10 h-10 rounded-full bg-primary-tint text-primary flex items-center justify-center">
                <UploadCloud size={18} />
              </span>
              <span className="text-sm font-semibold text-ink">{file ? file.name : "Choose a CSV file"}</span>
              <span className="text-xs text-ink-soft flex items-center gap-1"><FileText size={12} /> CSV</span>
              <input id="csv-upload" ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            </label>

            <Button type="button" onClick={handleUpload} disabled={!file || uploading} className="mt-4 w-full">
              {uploading ? "Uploading..." : "Upload"}
            </Button>

            {uploadResult && (
              <div className="mt-4 p-3 rounded-sm bg-accent-tint border border-accent/30 text-sm text-ink">
                <p className="font-medium">{uploadResult.message}</p>
                <p className="text-xs text-ink-soft mt-1">{uploadResult.note}</p>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}