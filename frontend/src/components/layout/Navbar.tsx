import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 2rem",
      height: "56px",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      background: "#0D1B2A",
      position: "sticky",
      top: 0,
      zIndex: 10,
    }}>
      <Link to="/" style={{
        fontWeight: 800,
        fontSize: "1.1875rem",
        textDecoration: "none",
        color: "#D4A843",
        letterSpacing: "-0.01em",
      }}>
        Chesslens
      </Link>

      <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
        {user ? (
          <>
            <Link to="/dashboard" style={{
              padding: "0.375rem 0.75rem",
              borderRadius: "6px",
              fontSize: "0.9rem",
              fontWeight: 500,
              color: "#8FA3B8",
              textDecoration: "none",
              transition: "background 0.15s, color 0.15s",
            }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = "#1A2E45"; (e.target as HTMLElement).style.color = "#F5F0E8"; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = "transparent"; (e.target as HTMLElement).style.color = "#8FA3B8"; }}
            >Dashboard</Link>
            <Link to="/import" style={{
              padding: "0.375rem 0.75rem",
              borderRadius: "6px",
              fontSize: "0.9rem",
              fontWeight: 500,
              color: "#8FA3B8",
              textDecoration: "none",
              transition: "background 0.15s, color 0.15s",
            }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = "#1A2E45"; (e.target as HTMLElement).style.color = "#F5F0E8"; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = "transparent"; (e.target as HTMLElement).style.color = "#8FA3B8"; }}
            >Import</Link>
            <div style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.1)", margin: "0 0.25rem" }} />
            <span style={{ fontSize: "0.875rem", color: "#4D6A82", padding: "0 0.5rem" }}>{user.email}</span>
            <button className="btn-ghost" onClick={handleLogout} style={{ fontSize: "0.875rem", padding: "0.375rem 0.75rem" }}>
              Sign out
            </button>
          </>
        ) : (
          <Link to="/login">
            <button className="btn-ghost" style={{ fontSize: "0.9rem", padding: "0.375rem 0.875rem" }}>Sign in</button>
          </Link>
        )}
      </div>
    </nav>
  );
}
