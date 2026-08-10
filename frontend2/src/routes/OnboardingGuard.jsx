import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getOnboardingStatus } from "../api/onboarding";

export function OnboardingGuard({ children }) {
    const { user } = useAuth();
    const [status, setStatus] = useState("checking");

    useEffect(() => {
        if (!user || user.role === "admin") {
            setStatus("complete");
            return;
        }
        getOnboardingStatus(user.username)
            .then((data) => setStatus(data.onboarding_complete ? "complete" : "incomplete"))
            .catch(() => setStatus("incomplete"));
    }, [user]);

    if (status === "checking") {
        return (
            <div className="flex-center" style={{ minHeight: "100vh", backgroundColor: "var(--color-bg-base)" }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{
                        width: "50px",
                        height: "50px",
                        border: "5px solid var(--color-border)",
                        borderTop: "5px solid var(--color-primary)",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        margin: "0 auto var(--spacing-md)"
                    }}></div>
                    <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
                    <p style={{ color: "var(--color-text-muted)" }}>Checking account setup...</p>
                </div>
            </div>
        );
    }
    if (status === "incomplete") {
        return <Navigate to="/onboarding" replace />;
    }
    return children;
}
