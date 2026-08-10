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
import Admin from "./pages/Admin";

function AppLayout({ children, showAccessibility = true }) {
    return (
        <div className="app-container">
            <Navbar />
            {showAccessibility && <AccessibilityBar />}
            <main className="main-content">{children}</main>
        </div>
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
                <Route path="/onboarding" element={
                    <ProtectedRoute>
                        <Onboarding />
                    </ProtectedRoute>
                } />
                <Route path="/dashboard" element={
                    <ProtectedRoute><OnboardingGuard>
                        <AppLayout><Dashboard /></AppLayout>
                    </OnboardingGuard></ProtectedRoute>
                } />
                <Route path="/weather" element={
                    <ProtectedRoute><OnboardingGuard>
                        <AppLayout><Weather /></AppLayout>
                    </OnboardingGuard></ProtectedRoute>
                } />
                <Route path="/market" element={
                    <ProtectedRoute><OnboardingGuard>
                        <AppLayout><Market /></AppLayout>
                    </OnboardingGuard></ProtectedRoute>
                } />
                <Route path="/crop-tools" element={
                    <ProtectedRoute><OnboardingGuard>
                        <AppLayout><CropTools /></AppLayout>
                    </OnboardingGuard></ProtectedRoute>
                } />
                <Route path="/vision" element={
                    <ProtectedRoute><OnboardingGuard>
                        <AppLayout><VisionTools /></AppLayout>
                    </OnboardingGuard></ProtectedRoute>
                } />
                <Route path="/chat" element={
                    <ProtectedRoute><OnboardingGuard>
                        <AppLayout><Chat /></AppLayout>
                    </OnboardingGuard></ProtectedRoute>
                } />

                {/* Admin */}
                <Route path="/admin" element={
                    <AdminRoute>
                        <AppLayout showAccessibility={false}><Admin /></AppLayout>
                    </AdminRoute>
                } />
            </Routes>
        </AuthProvider>
    );
}
