import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Bug, CheckCircle2 } from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { getDiseaseHistory } from "../../api/vision";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function DiseaseHistory() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user?.username) return;
    getDiseaseHistory(user.username, 20)
      .then((data) => setHistory(data.history || []))
      .catch(() => setError(true));
  }, [user?.username]);

  if (error) {
    return <Panel className="p-8 text-center text-ink-soft">{t("vision.error")}</Panel>;
  }

  if (history === null) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (history.length === 0) {
    return <Panel className="p-8 text-center text-ink-soft">{t("vision.noHistory")}</Panel>;
  }

  return (
    <div className="flex flex-col gap-3">
      {history.map((entry, i) => (
        <RevealOnScroll key={i} delay={i * 0.03}>
          <Panel className="p-4 flex items-center gap-4">
            {entry.image_url ? (
              <img src={entry.image_url} alt="" className="w-16 h-16 rounded-sm object-cover shrink-0" />
            ) : (
              <span className="w-16 h-16 rounded-sm bg-bg flex items-center justify-center shrink-0 text-ink-soft">
                {entry.is_healthy ? <CheckCircle2 size={22} /> : <Bug size={22} />}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <div className={`font-semibold text-sm ${entry.is_healthy ? "text-accent" : "text-danger"}`}>
                {entry.is_healthy ? t("vision.healthy") : entry.disease}
              </div>
              {!entry.is_healthy && entry.severity && (
                <div className="text-xs text-ink-soft">{entry.severity}</div>
              )}
              <div className="text-xs text-ink-soft mt-0.5">{formatDate(entry.detected_at)}</div>
            </div>
            <div className="text-sm font-semibold text-ink-soft shrink-0">{Math.round(entry.confidence)}%</div>
          </Panel>
        </RevealOnScroll>
      ))}
    </div>
  );
}