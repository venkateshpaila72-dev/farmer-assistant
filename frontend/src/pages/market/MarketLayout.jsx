import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";

const tabs = [
  { to: "/market", key: "market.tabPrices", end: true },
  { to: "/market/trending", key: "market.tabTrending" },
];

export default function MarketLayout() {
  const { t } = useTranslation();
  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-6 md:py-10">
      <h1 className="text-2xl mb-1">{t("market.title")}</h1>
      <p className="text-ink-soft text-sm mb-6">{t("market.subtitle")}</p>

      <div className="flex gap-1.5 border-b border-border mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                "px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors duration-150",
                isActive ? "border-primary text-primary" : "border-transparent text-ink-soft hover:text-ink"
              )
            }
          >
            {t(tab.key)}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}