import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register, loginWithPassword, saveTokens, fetchMe } from "../services/auth";
import { useAuthStore } from "../store/authStore";
import { GoogleOAuthButton } from "../components/auth/GoogleOAuthButton";

export function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await register(email, password, fullName);
      const tokens = await loginWithPassword(email, password);
      saveTokens(tokens);
      const user = await fetchMe();
      setUser(user);
      setSuccess(true);
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "calc(100vh - 56px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      background: "#0D1B2A",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "400px",
        background: "#112236",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: "12px",
        padding: "2.25rem 2rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#D4A843", marginBottom: "0.375rem", letterSpacing: "-0.01em" }}>
            Chesslens
          </div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#F5F0E8", marginBottom: "0.25rem" }}>Create your account</h1>
          <p style={{ fontSize: "0.9rem", color: "#8FA3B8" }}>Start reviewing your games</p>
        </div>

        <GoogleOAuthButton />

        <div className="divider">or</div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div>
            <label className="label">Name</label>
            <input
              placeholder="Your name (optional)"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p style={{
              fontSize: "0.875rem",
              color: "#f87171",
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
              borderRadius: "6px",
              padding: "0.5rem 0.75rem",
              margin: 0,
            }}>{error}</p>
          )}

          {success && (
            <p style={{
              fontSize: "0.875rem",
              color: "#34d399",
              background: "rgba(52,211,153,0.08)",
              border: "1px solid rgba(52,211,153,0.2)",
              borderRadius: "6px",
              padding: "0.5rem 0.75rem",
              margin: 0,
            }}>Account created! Redirecting…</p>
          )}

          <button type="submit" disabled={isLoading || success} style={{ marginTop: "0.25rem", width: "100%", padding: "0.6875rem" }}>
            {isLoading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: "0.875rem", color: "#8FA3B8" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#2563EB", fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
