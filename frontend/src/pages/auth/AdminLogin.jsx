import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../context/AuthContext";
import { loginAdmin } from "../../api/auth";

export default function AdminLogin() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <AuthLayout>
      <h1 className="text-2xl mb-1.5">{t("adminLogin.title")}</h1>
      <p className="text-ink-soft text-sm mb-7">{t("adminLogin.subtitle")}</p>

      <Panel className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t("adminLogin.email")}
            name="email"
            type="email"
            autoComplete="username"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label={t("adminLogin.password")}
            name="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? t("adminLogin.submitting") : t("adminLogin.submit")}
          </Button>
        </form>
      </Panel>

      <p className="text-sm text-ink-soft text-center mt-5">
        <Link to="/login" className="text-ink-soft underline">
          {t("adminLogin.farmerLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
}