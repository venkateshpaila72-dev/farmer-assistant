import { Routes, Route } from "react-router-dom";
import { PageTransitionProvider } from "./context/PageTransitionContext.jsx";
import Home from "./pages/public/Home.jsx";
import FarmerLogin from "./pages/auth/FarmerLogin.jsx";
import FarmerRegister from "./pages/auth/FarmerRegister.jsx";
import AdminLogin from "./pages/auth/AdminLogin.jsx";
import OnboardingFlow from "./pages/onboarding/OnboardingFlow.jsx";
import DashboardHome from "./pages/dashboard/DashboardHome.jsx";
import CropToolsLayout from "./pages/crop-tools/CropToolsLayout.jsx";
import CropRecommendation from "./pages/crop-tools/CropRecommendation.jsx";
import FertilizerSuggestion from "./pages/crop-tools/FertilizerSuggestion.jsx";
import YieldPrediction from "./pages/crop-tools/YieldPrediction.jsx";
import VisionLayout from "./pages/vision/VisionLayout.jsx";
import DiseaseDetection from "./pages/vision/DiseaseDetection.jsx";
import SoilClassification from "./pages/vision/SoilClassification.jsx";
import DiseaseHistory from "./pages/vision/DiseaseHistory.jsx";
import MarketLayout from "./pages/market/MarketLayout.jsx";
import MarketPrices from "./pages/market/MarketPrices.jsx";
import TrendingCrops from "./pages/market/TrendingCrops.jsx";
import NewsLayout from "./pages/news/NewsLayout.jsx";
import NewsFeed from "./pages/news/NewsFeed.jsx";
import PestAlerts from "./pages/news/PestAlerts.jsx";
import SchemeNews from "./pages/news/SchemeNews.jsx";
import AnnouncementsFeed from "./pages/news/AnnouncementsFeed.jsx";
import ChatPage from "./pages/chat/ChatPage.jsx";
import ProfilePage from "./pages/profile/ProfilePage.jsx";
import { DashboardLayout } from "./layouts/DashboardLayout.jsx";
import { ProtectedRoute } from "./routes/ProtectedRoute.jsx";
import { OnboardingGuard } from "./routes/OnboardingGuard.jsx";
import { AdminRoute } from "./routes/AdminRoute.jsx";
import { AdminLayout } from "./layouts/AdminLayout.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import FarmerList from "./pages/admin/FarmerList.jsx";
import Analytics from "./pages/admin/Analytics.jsx";
import Announcements from "./pages/admin/Announcements.jsx";
import MarketDataUpload from "./pages/admin/MarketDataUpload.jsx";
import NotFound from "./pages/NotFound.jsx";

// Placeholders for tool pages not yet built (Phase 7).
function ToolPlaceholder({ label }) {
  return (
    <div className="flex items-center justify-center py-24 text-ink-soft">
      {label} coming soon.
    </div>
  );
}

function DashboardRoute({ children }) {
  return (
    <ProtectedRoute>
      <OnboardingGuard>
        <DashboardLayout>{children}</DashboardLayout>
      </OnboardingGuard>
    </ProtectedRoute>
  );
}

function AdminPageRoute({ children }) {
  return (
    <AdminRoute>
      <AdminLayout>{children}</AdminLayout>
    </AdminRoute>
  );
}

function App() {
  return (
    <PageTransitionProvider>
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<FarmerLogin />} />
      <Route path="/register" element={<FarmerRegister />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingFlow />
          </ProtectedRoute>
        }
      />

      <Route path="/dashboard" element={<DashboardRoute><DashboardHome /></DashboardRoute>} />

      <Route path="/crop-tools" element={<DashboardRoute><CropToolsLayout /></DashboardRoute>}>
        <Route index element={<CropRecommendation />} />
        <Route path="fertilizer" element={<FertilizerSuggestion />} />
        <Route path="yield" element={<YieldPrediction />} />
      </Route>

      <Route path="/vision" element={<DashboardRoute><VisionLayout /></DashboardRoute>}>
        <Route index element={<DiseaseDetection />} />
        <Route path="soil" element={<SoilClassification />} />
        <Route path="history" element={<DiseaseHistory />} />
      </Route>

      <Route path="/market" element={<DashboardRoute><MarketLayout /></DashboardRoute>}>
        <Route index element={<MarketPrices />} />
        <Route path="trending" element={<TrendingCrops />} />
      </Route>

      <Route path="/news" element={<DashboardRoute><NewsLayout /></DashboardRoute>}>
        <Route index element={<NewsFeed />} />
        <Route path="alerts" element={<PestAlerts />} />
        <Route path="schemes" element={<SchemeNews />} />
        <Route path="announcements" element={<AnnouncementsFeed />} />
      </Route>

      <Route path="/chat" element={<DashboardRoute><ChatPage /></DashboardRoute>} />
      <Route path="/profile" element={<DashboardRoute><ProfilePage /></DashboardRoute>} />

      <Route path="/admin" element={<AdminPageRoute><AdminDashboard /></AdminPageRoute>} />
      <Route path="/admin/farmers" element={<AdminPageRoute><FarmerList /></AdminPageRoute>} />
      <Route path="/admin/analytics" element={<AdminPageRoute><Analytics /></AdminPageRoute>} />
      <Route path="/admin/announcements" element={<AdminPageRoute><Announcements /></AdminPageRoute>} />
      <Route path="/admin/market-upload" element={<AdminPageRoute><MarketDataUpload /></AdminPageRoute>} />

      <Route path="*" element={<NotFound />} />
      </Routes>
    </PageTransitionProvider>
  );
}

export default App;