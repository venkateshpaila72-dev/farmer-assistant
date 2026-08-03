import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

// A thin persistent banner, not a full-page takeover — losing network
// mid-session shouldn't hide whatever's already on screen (cached prices,
// a chat conversation, etc.), it should just make clear why new requests
// aren't going through right now.
export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    function goOnline() { setOnline(true); }
    function goOffline() { setOnline(false); }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[999] bg-danger text-white text-sm font-medium py-2 px-4 flex items-center justify-center gap-2">
      <WifiOff size={15} />
      No internet connection — reconnecting automatically once you're back online.
    </div>
  );
}