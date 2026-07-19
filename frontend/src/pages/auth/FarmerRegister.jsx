import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { registerFarmer, loginFarmer } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";

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
    <AuthLayout maxWidth="max-w-lg">
      <h1 className="text-2xl mb-1.5">{t("register.title")}</h1>
      <p className="text-ink-soft text-sm mb-7">{t("register.subtitle")}</p>

      <Panel className="p-6">
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
          <Input label={t("register.username")} name="username" value={form.username} onChange={update("username")} required />
          <Input label={t("register.password")} name="password" type="password" value={form.password} onChange={update("password")} required />
          <Input label={t("register.phone")} name="phone" type="tel" value={form.phone} onChange={update("phone")} required />
          <Input label={t("register.doorNo")} name="door_no" value={form.door_no} onChange={update("door_no")} required />
          <Input label={t("register.village")} name="village" value={form.village} onChange={update("village")} required />
          <Input label={t("register.city")} name="city" value={form.city} onChange={update("city")} required />
          <Input label={t("register.state")} name="state" value={form.state} onChange={update("state")} required className="sm:col-span-2" />
          {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
          <Button type="submit" disabled={loading} className="sm:col-span-2 mt-1">
            {loading ? t("register.submitting") : t("register.submit")}
          </Button>
        </form>
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