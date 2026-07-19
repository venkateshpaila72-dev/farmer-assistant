import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../context/AuthContext";
import { loginFarmer } from "../../api/auth";

export default function FarmerLogin() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginFarmer(form.username, form.password);
      login(data);
      toast.success(`Welcome back, ${data.username}`);
      navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || t("login.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
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
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? t("login.submitting") : t("login.submit")}
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
  );
}