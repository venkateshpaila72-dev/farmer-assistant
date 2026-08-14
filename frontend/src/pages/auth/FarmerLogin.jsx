import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { WelcomeOverlay } from "../../components/system/WelcomeOverlay";
import { useAuth } from "../../context/AuthContext";
import { usePageTransition } from "../../context/PageTransitionContext";
import { loginFarmer } from "../../api/auth";

export default function FarmerLogin() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { transitionTo } = usePageTransition();
  const location = useLocation();

  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [welcomeUser, setWelcomeUser] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginFarmer(form.username, form.password);
      login(data);
      setLoading(false);
      setSuccess(true);
      toast.success(`Welcome back, ${data.username}`);
      // Hold on the button's success check-mark briefly so the click feels
      // acknowledged, then bring in the full-screen welcome moment.
      setTimeout(() => setWelcomeUser(data.username), 450);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || t("login.error"));
      setLoading(false);
    }
  }

  const dashboardTarget = location.state?.from?.pathname || "/dashboard";

  return (
    <>
      {welcomeUser && (
        <WelcomeOverlay name={welcomeUser} onComplete={() => transitionTo(dashboardTarget, { replace: true })} />
      )}

      <AuthLayout>
        <h1 className="text-2xl mb-1.5">{t("login.title")}</h1>
        <p className="text-ink-soft text-sm mb-7">{t("login.subtitle")}</p>

        <Panel className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label={t("login.username")}
              name="username"
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
            <Input
              label={t("login.password")}
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            {error && (
              <motion.p
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm text-danger"
              >
                {error}
              </motion.p>
            )}
            <Button type="submit" loading={loading} success={success} className="mt-1">
              {t("login.submit")}
            </Button>
          </form>
        </Panel>

        <p className="text-sm text-ink-soft text-center mt-5">
          {t("login.newHere")}{" "}
          <Link to="/register" className="text-primary font-semibold">
            {t("login.createAccount")}
          </Link>
        </p>
        <p className="text-sm text-ink-soft text-center mt-2">
          <Link to="/admin/login" className="text-ink-soft underline">
            {t("login.adminLogin")}
          </Link>
        </p>
      </AuthLayout>
    </>
  );
}