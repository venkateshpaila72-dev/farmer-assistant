import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
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
      // Backend register endpoint only confirms creation, doesn't return a
      // token — log in right after so the farmer lands straight in onboarding.
      const tokenData = await loginFarmer(form.username, form.password);
      login(tokenData);
      toast.success("Account created — let's set up your farm profile.");
      navigate("/onboarding", { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || "Registration failed. Try a different username.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout maxWidth="max-w-lg">
      <h1 className="text-2xl mb-1.5">Create your free account</h1>
      <p className="text-ink-soft text-sm mb-7">Takes about a minute. No cost, ever.</p>

      <Panel className="p-6">
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
          <Input label="Username" name="username" value={form.username} onChange={update("username")} required />
          <Input label="Password" name="password" type="password" value={form.password} onChange={update("password")} required />
          <Input label="Phone number" name="phone" type="tel" value={form.phone} onChange={update("phone")} required />
          <Input label="Door no." name="door_no" value={form.door_no} onChange={update("door_no")} required />
          <Input label="Village" name="village" value={form.village} onChange={update("village")} required />
          <Input label="City" name="city" value={form.city} onChange={update("city")} required />
          <Input label="State" name="state" value={form.state} onChange={update("state")} required className="sm:col-span-2" />
          {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
          <Button type="submit" disabled={loading} className="sm:col-span-2 mt-1">
            {loading ? "Creating account\u2026" : "Create account"}
          </Button>
        </form>
      </Panel>

      <p className="text-sm text-ink-soft text-center mt-5">
        Already have an account?{" "}
        <Link to="/login" className="text-primary font-semibold">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}