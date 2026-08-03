import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import i18n from "../i18n";
import { getOnboardingProfile } from "../api/onboarding";

const AuthContext = createContext(null);

// Reverse of LanguageStep's CODE_TO_BACKEND_NAME — backend stores the full
// display name ("Telugu"), i18next needs the short code ("te").
const BACKEND_NAME_TO_CODE = {
  English: "en", Hindi: "hi", Telugu: "te", Tamil: "ta",
  Kannada: "kn", Marathi: "mr", Bengali: "bn", Punjabi: "pa",
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const syncedForRef = useRef(null); // which username we've already applied the language sync for this session

  // Applies the farmer's saved chat_language to the whole site (not just
  // chat) the moment a session starts — fresh login, or reopening the app
  // with an existing token. Best-effort: silently skipped for admins /
  // anyone who hasn't finished onboarding yet, since there's no saved
  // language to sync for them.
  useEffect(() => {
    if (!user?.username || user.role === "admin") return;
    if (syncedForRef.current === user.username) return;
    syncedForRef.current = user.username;

    getOnboardingProfile(user.username)
      .then((profile) => {
        const code = BACKEND_NAME_TO_CODE[profile?.chat_language];
        if (code && code !== i18n.language) i18n.changeLanguage(code);
      })
      .catch(() => {
        // No onboarding profile yet, or request failed — not fatal, the
        // site just stays on whatever language it was already showing.
      });
  }, [user?.username, user?.role]);

  // Called after a successful /auth/verifyuser or /auth/verifyadmin response.
  // tokenData = { access_token, role, username }
  const login = useCallback((tokenData) => {
    const userData = { username: tokenData.username, role: tokenData.role };
    localStorage.setItem("token", tokenData.access_token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    syncedForRef.current = null;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);