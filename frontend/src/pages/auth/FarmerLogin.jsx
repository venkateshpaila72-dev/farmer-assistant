import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../context/AuthContext";
import { loginFarmer } from "../../api/auth";

export default function FarmerLogin() {
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
      setError(detail || "Login failed. Check your username and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl mb-1.5">Log in</h1>
      <p className="text-ink-soft text-sm mb-7">Check today&rsquo;s weather, prices, and advice for your farm.</p>

      <Panel className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Username"
            name="username"
            autoComplete="username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
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
        New here?{" "}
        <Link to="/register" className="text-primary font-semibold">
          Create an account
        </Link>
      </p>
      <p className="text-sm text-ink-soft text-center mt-2">
        <Link to="/admin/login" className="text-ink-soft underline">
          Admin login
        </Link>
      </p>
    </AuthLayout>
  );
}