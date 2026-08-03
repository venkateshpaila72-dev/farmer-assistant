import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ToastProvider } from "./context/ToastProvider.jsx";
import { BackendWakeGate } from "./components/system/BackendWakeGate.jsx";
import { OfflineBanner } from "./components/system/OfflineBanner.jsx";
import "./i18n/index.js";
import "./styles/index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <BackendWakeGate>
        <AuthProvider>
          <ToastProvider>
            <OfflineBanner />
            <App />
          </ToastProvider>
        </AuthProvider>
      </BackendWakeGate>
    </BrowserRouter>
  </StrictMode>
);