import { LoginForm } from "../components/auth/LoginForm";
import { GoogleOAuthButton } from "../components/auth/GoogleOAuthButton";
import { Link } from "react-router-dom";

export function Login() {
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
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#F5F0E8", marginBottom: "0.25rem" }}>Welcome back</h1>
          <p style={{ fontSize: "0.9rem", color: "#8FA3B8" }}>Sign in to your account</p>
        </div>

        <GoogleOAuthButton />

        <div className="divider">or</div>

        <LoginForm />

        <p style={{ textAlign: "center", fontSize: "0.875rem", color: "#8FA3B8" }}>
          No account?{" "}
          <Link to="/register" style={{ color: "#2563EB", fontWeight: 600 }}>Create one</Link>
        </p>
      </div>
    </div>
  );
}
