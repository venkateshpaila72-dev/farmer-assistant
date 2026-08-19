import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { titleCase, timeOfDayGreeting } from "../../utils/formatters";

export function Topbar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const displayName = titleCase(user?.username);
  const initial = displayName ? displayName.charAt(0).toUpperCase() : "";
  const greetingKey = `topbar.greeting${titleCase(timeOfDayGreeting())}`;

  return (
    <header className="h-[68px] flex items-center justify-between gap-4 px-5 md:px-8 bg-surface/35 backdrop-blur-lg">
      <div className="flex items-center gap-3 min-w-0">
        <div className="hidden sm:flex w-9 h-9 rounded-full bg-primary-tint text-primary font-display font-semibold items-center justify-center shrink-0 text-sm">
          {initial}
        </div>
        <p className="text-sm text-ink-soft truncate">
          {t(greetingKey, { name: displayName })}
        </p>
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