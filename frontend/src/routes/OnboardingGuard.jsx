import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getOnboardingStatus } from "../api/onboarding";
import { ErrorState } from "../components/ui/ErrorState";

export function OnboardingGuard({ children }) {
  const { user } = useAuth();
  const [status, setStatus] = useState("checking"); // checking | complete | incomplete | error
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!user || user.role === "admin") {
      setStatus("complete"); // admins skip onboarding entirely
      return;
    }
    setStatus("checking");
    getOnboardingStatus(user.username)
      .then((data) => setStatus(data.onboarding_complete ? "complete" : "incomplete"))
      .catch((err) => {
        if (err.response?.status === 401) {
          return;
        }
        setStatus("error");
      });
  }, [user?.username, user?.role, retry]);

  if (status === "checking") {
    return <div className="min-h-screen flex items-center justify-center text-ink-soft">Loading&hellip;</div>;
  }
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ErrorState
          message="Could not check onboarding status."
          onRetry={() => setRetry((r) => r + 1)}
        />
      </div>
    );
  }
  if (status === "incomplete") {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}