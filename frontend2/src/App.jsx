import React from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { AdminRoute } from "./routes/AdminRoute";
import { OnboardingGuard } from "./routes/OnboardingGuard";

import Navbar from "./components/Navbar";
import AccessibilityBar from "./components/AccessibilityBar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminLogin from "./pages/AdminLogin";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Weather from "./pages/Weather";
import Market from "./pages/Market";
import CropTools from "./pages/CropTools";
import VisionTools from "./pages/VisionTools";
import Chat from "./pages/Chat";
import News from "./pages/News";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

function AppLayout({ children, showAccessibility = true }) {
    return (
        <div className="app-container">
            <Navbar />
            {showAccessibility && <AccessibilityBar />}
            <main className="main-content">{children}</main>
        </div>
    );
}

function FarmerRoute({ children }) {
    return (
        <ProtectedRoute>
            <OnboardingGuard>
                <AppLayout>{children}</AppLayout>
            </OnboardingGuard>
        </ProtectedRoute>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <Routes>
                {/* Public */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/admin/login" element={<AdminLogin />} />

                {/* Farmer — Protected + Onboarding */}
                <Route
                    path="/onboarding"
                    element={
                        <ProtectedRoute>
                            <Onboarding />
                        </ProtectedRoute>
                    }
                />

                <Route path="/dashboard" element={<FarmerRoute><Dashboard /></FarmerRoute>} />
                <Route path="/weather" element={<FarmerRoute><Weather /></FarmerRoute>} />
                <Route path="/market" element={<FarmerRoute><Market /></FarmerRoute>} />
                <Route path="/crop-tools" element={<FarmerRoute><CropTools /></FarmerRoute>} />
                <Route path="/vision" element={<FarmerRoute><VisionTools /></FarmerRoute>} />
                <Route path="/chat" element={<FarmerRoute><Chat /></FarmerRoute>} />
                <Route path="/news" element={<FarmerRoute><News /></FarmerRoute>} />
                <Route path="/profile" element={<FarmerRoute><Profile /></FarmerRoute>} />

                {/* Admin */}
                <Route
                    path="/admin"
                    element={
                        <AdminRoute>
                            <AppLayout showAccessibility={false}><Admin /></AppLayout>
                        </AdminRoute>
                    }
                />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
            </Routes>
        </AuthProvider>
    );
}
