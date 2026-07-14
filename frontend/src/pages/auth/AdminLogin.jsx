import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../context/AuthContext";
import { loginAdmin } from "../../api/auth";

export default function AdminLogin() {
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
      setError(detail || "Login failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl mb-1.5">Admin login</h1>
      <p className="text-ink-soft text-sm mb-7">For platform administrators only.</p>

      <Panel className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="username"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? "Logging in\u2026" : "Log in"}
          </Button>
        </form>
      </Panel>

      <p className="text-sm text-ink-soft text-center mt-5">
        <Link to="/login" className="text-ink-soft underline">
          Farmer login
        </Link>
      </p>
    </AuthLayout>
  );
}