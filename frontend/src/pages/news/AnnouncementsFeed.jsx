import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Megaphone } from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { getPublicAnnouncements } from "../../api/news";
import { getCached, setCached } from "../../utils/dataCache";

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diffMs / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AnnouncementsFeed() {
  const { t } = useTranslation();
  const [announcements, setAnnouncements] = useState(() => getCached("news:announcements") ?? null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    getPublicAnnouncements()
      .then((data) => {
        const list = data.announcements || [];
        setAnnouncements(list);
        setCached("news:announcements", list);
      })
      .catch(() => {
        if (getCached("news:announcements") === undefined) setError(true);
      });
  }

  useEffect(() => {
    // Cached announcements (if any) already show via the initializer — this
    // refetches quietly in the background rather than resetting to a skeleton.
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <ErrorState message={t("news.loadError")} onRetry={load} />;
  }

  if (announcements === null) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  if (announcements.length === 0) {
    return <Panel className="p-8 text-center text-ink-soft">{t("news.noAnnouncements")}</Panel>;
  }

  return (
    <div className="flex flex-col gap-3">
      {announcements.map((a, i) => (
        <RevealOnScroll key={i} delay={Math.min(i, 6) * 0.04}>
          <Panel className="p-4">
            {a.image_url && (
              <img src={a.image_url} alt="" className="w-full max-h-64 object-cover rounded-sm border border-border mb-3" />
            )}
            <div className="flex items-start gap-2.5">
              <Megaphone size={17} className="text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink leading-snug">{a.title}</h3>
                  {a.updated_at && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-accent bg-accent-tint px-1.5 py-0.5 rounded-sm shrink-0">
                      {t("news.edited")}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-soft mt-1.5 whitespace-pre-wrap">{a.content}</p>
                {a.created_at && (
                  <p className="text-xs text-ink-soft mt-2">{timeAgo(a.updated_at || a.created_at)}</p>
                )}
              </div>
            </div>
          </Panel>
        </RevealOnScroll>
      ))}
    </div>
  );
}