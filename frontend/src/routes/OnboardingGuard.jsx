import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getOnboardingStatus } from "../api/onboarding";

export function OnboardingGuard({ children }) {
  const { user } = useAuth();
  const [status, setStatus] = useState("checking"); // checking | complete | incomplete

  useEffect(() => {
    if (!user || user.role === "admin") {
      setStatus("complete"); // admins skip onboarding entirely
      return;
    }
    getOnboardingStatus(user.username)
      .then((data) => setStatus(data.onboarding_complete ? "complete" : "incomplete"))
      .catch(() => setStatus("incomplete"));
  }, [user]);

  if (status === "checking") {
    return <div className="min-h-screen flex items-center justify-center text-ink-soft">Loading&hellip;</div>;
  }
  if (status === "incomplete") {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}