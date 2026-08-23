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

const easeOut = [0.16, 1, 0.3, 1];
const fieldUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

// Percent-based box over the phone's screen in /farmer-login-art.png,
// used to place the focus-reactive glow precisely on the app UI.
const PHONE_SCREEN_GLOW = { left: "66.5%", top: "20.5%", width: "26%", height: "44%" };

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
  const [formFocused, setFormFocused] = useState(false);

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

      <AuthLayout
        illustrationSrc="/farmer-login-art.png"
        illustrationAlt="A farmer in a wheat field checking today's weather, crop status, and mandi prices on the Kisan Sahayak app"
        panelVariant="scene"
        screenGlow={PHONE_SCREEN_GLOW}
        formFocused={formFocused}
      >
        <motion.h1
          className="text-2xl mb-1.5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOut }}
        >
          {t("login.title")}
        </motion.h1>
        <motion.p
          className="text-ink-soft text-sm mb-7"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: easeOut }}
        >
          {t("login.subtitle")}
        </motion.p>

        <Panel className="p-6">
          <motion.form
            onSubmit={handleSubmit}
            onFocus={() => setFormFocused(true)}
            onBlur={(e) => {
              // Only drop back to idle once focus actually leaves the form
              // (not just moving between two fields inside it).
              if (!e.currentTarget.contains(e.relatedTarget)) setFormFocused(false);
            }}
            className="flex flex-col gap-4"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }}
          >
            <motion.div variants={fieldUp} transition={{ duration: 0.35, ease: easeOut }}>
              <Input
                label={t("login.username")}
                name="username"
                autoComplete="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            </motion.div>
            <motion.div variants={fieldUp} transition={{ duration: 0.35, ease: easeOut }}>
              <Input
                label={t("login.password")}
                name="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </motion.div>
            {error && (
              <motion.p
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm text-danger"
              >
                {error}
              </motion.p>
            )}
            <motion.div variants={fieldUp} transition={{ duration: 0.35, ease: easeOut }}>
              <Button type="submit" loading={loading} success={success} className="mt-1 w-full">
                {t("login.submit")}
              </Button>
            </motion.div>
          </motion.form>
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