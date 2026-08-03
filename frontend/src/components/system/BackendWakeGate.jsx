import { useEffect, useRef, useState } from "react";
import { Sprout } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const INITIAL_CHECK_TIMEOUT_MS = 4000;  // how long we wait before assuming the backend is asleep
const RETRY_INTERVAL_MS = 3000;         // how often we re-check while it's waking up
const LONG_WAIT_MS = 20000;             // when to switch to the "hang tight, this is normal" message

// Cycles through fun, honest status lines while polling — none of these are
// literally true one-by-one (we can't actually see inside the server), but
// together they tell the real story: a free-tier host spinning a sleeping
// backend back up, which genuinely does take this long. Better than a blank
// screen that makes people think the site is just broken.
const STATUS_MESSAGES = [
  "🌱 Waking up the server...",
  "🗄️ Starting the database...",
  "🤖 Warming up the AI agents...",
  "🌾 Almost ready...",
];

async function pingHealth(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Gates the whole app behind a real check of the backend's /health endpoint.
// If it's already awake (the common case — an active site, or a warm
// container), this resolves in well under a second and nothing is ever
// shown. Only shows the waking-up screen when the backend genuinely doesn't
// respond in time, which is exactly the free-tier cold-start scenario this
// was built for — without it, the app just sits there silently while axios
// calls fail, and a farmer has no way to know whether to wait or give up.
export function BackendWakeGate({ children }) {
  const [awake, setAwake] = useState(null); // null = still checking, true/false after
  const [messageIndex, setMessageIndex] = useState(0);
  const [longWait, setLongWait] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;

    async function checkLoop(timeoutMs) {
      const ok = await pingHealth(timeoutMs);
      if (cancelled) return;
      if (ok) {
        setAwake(true);
        return;
      }
      setAwake(false);
      setTimeout(() => checkLoop(RETRY_INTERVAL_MS), RETRY_INTERVAL_MS);
    }

    checkLoop(INITIAL_CHECK_TIMEOUT_MS);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (awake !== false) return;
    const rotate = setInterval(() => {
      setMessageIndex((i) => (i + 1) % STATUS_MESSAGES.length);
      if (Date.now() - startedAt.current > LONG_WAIT_MS) setLongWait(true);
    }, 2200);
    return () => clearInterval(rotate);
  }, [awake]);

  // Still doing the very first check, or already confirmed awake — render
  // the real app immediately, no flash of a loading screen for the common case.
  if (awake !== false) return children;

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center px-6">
      <div className="w-16 h-16 rounded-full bg-primary-tint text-primary flex items-center justify-center mb-6 animate-pulse">
        <Sprout size={28} />
      </div>
      <p className="font-display text-lg font-semibold text-ink transition-opacity duration-300">
        {STATUS_MESSAGES[messageIndex]}
      </p>
      <div className="flex items-center gap-1.5 mt-4">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      {longWait && (
        <p className="text-sm text-ink-soft mt-6 max-w-xs">
          Free hosting puts the server to sleep after a while — it's genuinely on its way, just taking a bit longer than usual.
        </p>
      )}
    </div>
  );
}