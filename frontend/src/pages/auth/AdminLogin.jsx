import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../context/AuthContext";
import { loginAdmin } from "../../api/auth";

const easeOut = [0.16, 1, 0.3, 1];
const fieldUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

// Same illustration + glow spot as the registration page, per design brief.
const TABLET_SCREEN_GLOW = { left: "33%", top: "74%", width: "9%", height: "8%" };

export default function AdminLogin() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [formFocused, setFormFocused] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginAdmin(form.email, form.password);
      login(data);
      toast.success(`Welcome, ${data.username}`);
      navigate("/admin", { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || t("adminLogin.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      illustrationSrc="/farmer-register-art.png"
      illustrationAlt="A woman farmer setting up her Kisan Sahayak account at a desk with a laptop, tablet, and potted seedling"
      panelVariant="split"
      screenGlow={TABLET_SCREEN_GLOW}
      formFocused={formFocused}
    >
      <motion.h1
        className="text-2xl mb-1.5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut }}
      >
        {t("adminLogin.title")}
      </motion.h1>
      <motion.p
        className="text-ink-soft text-sm mb-7"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: easeOut }}
      >
        {t("adminLogin.subtitle")}
      </motion.p>

      <Panel className="p-6">
        <motion.form
          onSubmit={handleSubmit}
          onFocus={() => setFormFocused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setFormFocused(false);
          }}
          className="flex flex-col gap-4"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }}
        >
          <motion.div variants={fieldUp} transition={{ duration: 0.35, ease: easeOut }}>
            <Input
              label={t("adminLogin.email")}
              name="email"
              type="email"
              autoComplete="username"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </motion.div>
          <motion.div variants={fieldUp} transition={{ duration: 0.35, ease: easeOut }}>
            <Input
              label={t("adminLogin.password")}
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </motion.div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <motion.div variants={fieldUp} transition={{ duration: 0.35, ease: easeOut }}>
            <Button type="submit" disabled={loading} className="mt-1 w-full">
              {loading ? t("adminLogin.submitting") : t("adminLogin.submit")}
            </Button>
          </motion.div>
        </motion.form>
      </Panel>

      <p className="text-sm text-ink-soft text-center mt-5">
        <Link to="/login" className="text-ink-soft underline">
          {t("adminLogin.farmerLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
}