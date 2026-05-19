import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function Home() {
  const { user } = useAuthStore();

  return (
    <div style={{ background: "#0D1B2A" }}>
      {/* Hero */}
      <section style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "6rem 2rem 5rem",
        maxWidth: "720px",
        margin: "0 auto",
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "rgba(212,168,67,0.12)",
          color: "#D4A843",
          fontSize: "0.8125rem",
          fontWeight: 600,
          padding: "0.3125rem 0.875rem",
          borderRadius: "999px",
          marginBottom: "1.75rem",
          letterSpacing: "0.02em",
          border: "1px solid rgba(212,168,67,0.2)",
        }}>
          Powered by Stockfish + Claude AI
        </div>

        <h1 style={{
          fontSize: "clamp(2.5rem, 5vw, 3.75rem)",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          marginBottom: "1.25rem",
          color: "#F5F0E8",
        }}>
          Build your<br />
          <span style={{ color: "#D4A843" }}>Chess Profile</span>
        </h1>

        <p style={{
          fontSize: "1.125rem",
          color: "#8FA3B8",
          lineHeight: 1.6,
          maxWidth: "520px",
          marginBottom: "2.5rem",
          fontWeight: 400,
        }}>
          Import your games from Chess.com. The more games, the more accurate your profile. We recommend 100+ games.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          {user ? (
            <Link to="/dashboard">
              <button style={{
                fontSize: "1rem", padding: "0.75rem 2rem",
                background: "#D4A843", color: "#0D1B2A", border: "none",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#C49B35"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#D4A843"; }}
              >Go to Dashboard</button>
            </Link>
          ) : (
            <>
              <Link to="/register">
                <button style={{
                  fontSize: "1rem", padding: "0.75rem 2rem",
                  background: "#D4A843", color: "#0D1B2A", border: "none",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#C49B35"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#D4A843"; }}
                >Get Started</button>
              </Link>
              <Link to="/login">
                <button className="btn-ghost" style={{ fontSize: "1rem", padding: "0.75rem 2rem" }}>Sign in</button>
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Feature cards */}
      <section style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "0 2rem 6rem",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "1px",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
        overflow: "hidden",
        background: "rgba(255,255,255,0.04)",
      }}>
        {[
          {
            icon: "◎",
            title: "Instant profile",
            desc: "Opening repertoire, playing style, and coaching recommendations generated in seconds — no waiting.",
          },
          {
            icon: "♟",
            title: "Deep accuracy analysis",
            desc: "Selective Stockfish analysis identifies your real patterns across thousands of games — not just one.",
          },
          {
            icon: "⬡",
            title: "Scales with your library",
            desc: "10 games or 10,000 — the more you import, the more reliable your profile becomes.",
          },
        ].map((f) => (
          <div key={f.title} style={{
            background: "#112236",
            padding: "1.75rem",
          }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.875rem" }}>{f.icon}</div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.5rem", color: "#F5F0E8" }}>{f.title}</h3>
            <p style={{ fontSize: "0.9rem", color: "#8FA3B8", lineHeight: 1.6 }}>{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
