import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border py-10 text-sm text-ink-soft">
      <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
        <span>{t("footer.tagline")}</span>
        <span>&copy; {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}