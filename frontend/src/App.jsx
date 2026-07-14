import { Routes, Route } from "react-router-dom";
import Home from "./pages/public/Home.jsx";
import FarmerLogin from "./pages/auth/FarmerLogin.jsx";
import FarmerRegister from "./pages/auth/FarmerRegister.jsx";
import AdminLogin from "./pages/auth/AdminLogin.jsx";
import OnboardingFlow from "./pages/onboarding/OnboardingFlow.jsx";
import { ProtectedRoute } from "./routes/ProtectedRoute.jsx";
import { OnboardingGuard } from "./routes/OnboardingGuard.jsx";
import { AdminRoute } from "./routes/AdminRoute.jsx";

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center text-ink-soft">
      Page not found.
    </div>
  );
}

// Placeholder until Phase 3 builds the real dashboard.
function DashboardPlaceholder() {
  return (
    <div className="min-h-screen flex items-center justify-center text-ink-soft">
      Dashboard coming in Phase 3.
    </div>
  );
}

function AdminPlaceholder() {
  return (
    <div className="min-h-screen flex items-center justify-center text-ink-soft">
      Admin panel coming in Phase 8.
    </div>
  );
}

function App() {
  return (
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

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <OnboardingGuard>
              <DashboardPlaceholder />
            </OnboardingGuard>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPlaceholder />
          </AdminRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;