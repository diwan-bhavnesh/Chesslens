import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useGameStore } from "../../store/gameStore";

export function Navbar() {
  const { user, logout } = useAuthStore();
  const hasGames = useGameStore(state => state.games.length > 0);
  const navigate = useNavigate();

  // Real accounts always get the library links — that's correct, existing
  // behavior. A guest session only gets them once it actually has games,
  // so the landing page doesn't imply a library that doesn't exist yet.
  const showLibraryLinks = user && (!user.is_guest || hasGames);

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
        {showLibraryLinks && (
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
            <Link to="/my-games" style={{
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
            >My Games</Link>
          </>
        )}
        {user && !user.is_guest && (
          <>
            <div style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.1)", margin: "0 0.25rem" }} />
            <span style={{ fontSize: "0.875rem", color: "#4D6A82", padding: "0 0.5rem" }}>
              {user.email}
            </span>
            <button className="btn-ghost" onClick={handleLogout} style={{ fontSize: "0.875rem", padding: "0.375rem 0.75rem" }}>
              Sign out
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
