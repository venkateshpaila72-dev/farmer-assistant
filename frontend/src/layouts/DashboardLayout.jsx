import { Sidebar } from "../components/layout/Sidebar";
import { BottomNav } from "../components/layout/BottomNav";
import { Topbar } from "../components/layout/Topbar";
import { PageFade } from "../components/motion/PageFade";
import { WeatherSkyBackground } from "../components/backgrounds/WeatherSkyBackground";
import { WeatherBackgroundProvider } from "../context/WeatherBackgroundContext";

export function DashboardLayout({ children }) {
  return (
    <WeatherBackgroundProvider>
      <div className="min-h-screen md:flex relative">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 relative">
          <Topbar />
          <main className="flex-1 pb-20 md:pb-0 relative">
            <WeatherSkyBackground />
            <div className="relative">
              <PageFade>{children}</PageFade>
            </div>
          </main>
        </div>
        <BottomNav />
      </div>
    </WeatherBackgroundProvider>
  );
}