import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithPassword, saveTokens, fetchMe } from "../../services/auth";
import { useAuthStore } from "../../store/authStore";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const tokens = await loginWithPassword(email, password);
      saveTokens(tokens);
      const user = await fetchMe();
      setUser(user);
      setSuccess(true);
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch {
      setError("Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
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
        }}>Signed in! Redirecting…</p>
      )}
      <button type="submit" disabled={isLoading || success} style={{ marginTop: "0.25rem", width: "100%", padding: "0.6875rem" }}>
        {isLoading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
