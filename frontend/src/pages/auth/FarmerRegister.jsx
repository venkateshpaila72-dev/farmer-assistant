import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { registerFarmer, loginFarmer } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";

const easeOut = [0.16, 1, 0.3, 1];
const fieldUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

// Percent-based box over the tablet's screen in /farmer-register-art.png,
// used to place the focus-reactive glow precisely on the app UI.
const TABLET_SCREEN_GLOW = { left: "33%", top: "74%", width: "9%", height: "8%" };

const initial = {
  username: "",
  password: "",
  phone: "",
  door_no: "",
  village: "",
  city: "",
  state: "",
};

export default function FarmerRegister() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [formFocused, setFormFocused] = useState(false);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await registerFarmer(form);
      const tokenData = await loginFarmer(form.username, form.password);
      login(tokenData);
      toast.success("Account created — let's set up your farm profile.");
      navigate("/onboarding", { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || t("register.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      maxWidth="max-w-lg"
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
        {t("register.title")}
      </motion.h1>
      <motion.p
        className="text-ink-soft text-sm mb-7"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: easeOut }}
      >
        {t("register.subtitle")}
      </motion.p>

      <Panel className="p-6">
        <motion.form
          onSubmit={handleSubmit}
          onFocus={() => setFormFocused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setFormFocused(false);
          }}
          className="grid sm:grid-cols-2 gap-4"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } }}
        >
          <motion.div variants={fieldUp} transition={{ duration: 0.3, ease: easeOut }}>
            <Input label={t("register.username")} name="username" value={form.username} onChange={update("username")} required />
          </motion.div>
          <motion.div variants={fieldUp} transition={{ duration: 0.3, ease: easeOut }}>
            <Input label={t("register.password")} name="password" type="password" value={form.password} onChange={update("password")} required />
          </motion.div>
          <motion.div variants={fieldUp} transition={{ duration: 0.3, ease: easeOut }}>
            <Input label={t("register.phone")} name="phone" type="tel" value={form.phone} onChange={update("phone")} required />
          </motion.div>
          <motion.div variants={fieldUp} transition={{ duration: 0.3, ease: easeOut }}>
            <Input label={t("register.doorNo")} name="door_no" value={form.door_no} onChange={update("door_no")} required />
          </motion.div>
          <motion.div variants={fieldUp} transition={{ duration: 0.3, ease: easeOut }}>
            <Input label={t("register.village")} name="village" value={form.village} onChange={update("village")} required />
          </motion.div>
          <motion.div variants={fieldUp} transition={{ duration: 0.3, ease: easeOut }}>
            <Input label={t("register.city")} name="city" value={form.city} onChange={update("city")} required />
          </motion.div>
          <motion.div variants={fieldUp} transition={{ duration: 0.3, ease: easeOut }} className="sm:col-span-2">
            <Input label={t("register.state")} name="state" value={form.state} onChange={update("state")} required />
          </motion.div>
          {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
          <motion.div variants={fieldUp} transition={{ duration: 0.3, ease: easeOut }} className="sm:col-span-2 mt-1">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t("register.submitting") : t("register.submit")}
            </Button>
          </motion.div>
        </motion.form>
      </Panel>

      <p className="text-sm text-ink-soft text-center mt-5">
        {t("register.haveAccount")}{" "}
        <Link to="/login" className="text-primary font-semibold">
          {t("register.login")}
        </Link>
      </p>
    </AuthLayout>
  );
}