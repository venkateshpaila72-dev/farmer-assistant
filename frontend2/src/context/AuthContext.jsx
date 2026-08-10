import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import i18n from "../i18n";
import { getOnboardingProfile } from "../api/onboarding";

const AuthContext = createContext(null);

const BACKEND_NAME_TO_CODE = {
    English: "en", Hindi: "hi", Telugu: "te", Tamil: "ta",
    Kannada: "kn", Marathi: "mr", Bengali: "bn", Punjabi: "pa",
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem("user");
        return stored ? JSON.parse(stored) : null;
    });
    const syncedForRef = useRef(null);

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
                // No onboarding profile yet or failed, skip silently
            });
    }, [user?.username, user?.role]);

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
