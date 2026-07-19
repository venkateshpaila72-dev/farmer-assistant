import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Topbar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="h-[68px] flex items-center justify-between gap-4 px-5 md:px-8 border-b border-border bg-surface">
      <div className="min-w-0">
        <p className="text-sm text-ink-soft truncate">{t("topbar.greeting", { name: user?.username || "" })}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <LanguageSwitcher />
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-danger transition-colors duration-150"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">{t("topbar.logout")}</span>
        </button>
      </div>
    </header>
  );
}