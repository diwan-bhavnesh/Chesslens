import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";
import { useProfileStore } from "../store/profileStore";

type Platform = "chesscom";
type GameType = "all" | "bullet" | "blitz" | "rapid" | "classical" | "chess960";

type TCOption = { label: string; value: string };
type TCGroup = { group: string | null; options: TCOption[] };

const TIME_CONTROLS: Record<GameType, TCGroup[]> = {
  all: [
    { group: "Bullet", options: [{ label: "1 min", value: "1+0" }, { label: "1|1", value: "1+1" }, { label: "2|1", value: "2+1" }] },
    { group: "Blitz",  options: [{ label: "3 min", value: "3+0" }, { label: "3|2", value: "3+2" }, { label: "5 min", value: "5+0" }, { label: "5|2", value: "5+2" }, { label: "5|5", value: "5+5" }] },
    { group: "Rapid",  options: [{ label: "10 min", value: "10+0" }, { label: "10|5", value: "10+5" }, { label: "15|10", value: "15+10" }, { label: "30 min", value: "30+0" }] },
    { group: "Classical", options: [{ label: "30|20", value: "30+20" }, { label: "60 min", value: "60+0" }, { label: "90|30", value: "90+30" }] },
  ],
  bullet: [
    { group: null, options: [{ label: "1 min", value: "1+0" }, { label: "1|1", value: "1+1" }, { label: "2|1", value: "2+1" }] },
  ],
  blitz: [
    { group: null, options: [{ label: "3 min", value: "3+0" }, { label: "3|2", value: "3+2" }, { label: "5 min", value: "5+0" }, { label: "5|2", value: "5+2" }, { label: "5|5", value: "5+5" }] },
  ],
  rapid: [
    { group: null, options: [{ label: "10 min", value: "10+0" }, { label: "10|5", value: "10+5" }, { label: "15|10", value: "15+10" }, { label: "30 min", value: "30+0" }] },
  ],
  classical: [
    { group: null, options: [{ label: "30|20", value: "30+20" }, { label: "60 min", value: "60+0" }, { label: "90|30", value: "90+30" }] },
  ],
  chess960: [
    { group: "Bullet 960", options: [{ label: "1 min", value: "960_1+0" }, { label: "1|1", value: "960_1+1" }, { label: "2|1", value: "960_2+1" }] },
    { group: "Blitz 960",  options: [{ label: "3 min", value: "960_3+0" }, { label: "3|2", value: "960_3+2" }, { label: "5 min", value: "960_5+0" }, { label: "5|2", value: "960_5+2" }] },
    { group: "Rapid 960",  options: [{ label: "10 min", value: "960_10+0" }, { label: "15|10", value: "960_15+10" }] },
  ],
};

const GAME_TYPES: { value: GameType; label: string }[] = [
  { value: "all",       label: "All" },
  { value: "bullet",    label: "Bullet" },
  { value: "blitz",     label: "Blitz" },
  { value: "rapid",     label: "Rapid" },
  { value: "classical", label: "Classical" },
  { value: "chess960",  label: "Chess 960" },
];

type JobStatus = {
  id: string;
  status: "pending" | "running" | "done" | "failed";
  games_imported: number;
  error?: string;
};

export function ImportGames() {
  const navigate = useNavigate();
  const { createProfile } = useProfileStore();
  const [platform, setPlatform]     = useState<Platform>("chesscom");
  const [username, setUsername]     = useState("");
  const [dateRange, setDateRange]   = useState("3m");
  const [gameType, setGameType]     = useState<GameType>("all");
  const [timeControl, setTimeControl] = useState("all");
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [jobStatus, setJobStatus]   = useState<JobStatus | null>(null);

  const handleGameTypeChange = (type: GameType) => {
    setGameType(type);
    setTimeControl("all");
  };

  const tcGroups = TIME_CONTROLS[gameType];

  const pollJob = async (jobId: string): Promise<void> => {
    while (true) {
      const { data: job } = await api.get<JobStatus>(`/games/import/jobs/${jobId}`);
      setJobStatus(job);
      if (job.status === "done") {
        await createProfile().catch(() => {});
        navigate("/dashboard");
        return;
      }
      if (job.status === "failed") {
        setError(job.error ?? "Import failed.");
        setIsLoading(false);
        return;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setJobStatus(null);
    setIsLoading(true);
    try {
      const { data: job } = await api.post<JobStatus>(`/games/import/${platform}`, {
        source: platform,
        username,
        max_games: 0,
        date_range: dateRange,
        game_type: gameType,
        time_control: timeControl,
      });
      setJobStatus(job);
      await pollJob(job.id);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Import failed. Please check your username and try again."
      );
      setIsLoading(false);
    }
  };

  const loadingLabel = () => {
    if (!jobStatus) return "Starting…";
    if (jobStatus.status === "pending") return "Queued…";
    if (jobStatus.status === "done") return `✓ ${jobStatus.games_imported} games imported — redirecting…`;
    if (jobStatus.status === "running") {
      return jobStatus.games_imported > 0
        ? `Importing… (${jobStatus.games_imported} saved)`
        : "Importing…";
    }
    return "Importing…";
  };

  return (
    <div style={{
      minHeight: "calc(100vh - 56px)",
      background: "#0D1B2A",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "2.5rem 1rem 4rem",
    }}>
      <div style={{ width: "100%", maxWidth: "460px", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* Top nav */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <Link to="/dashboard" style={{
            display: "inline-flex", alignItems: "center", gap: "0.375rem",
            fontSize: "0.875rem", color: "#8FA3B8", textDecoration: "none", fontWeight: 500,
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to dashboard
          </Link>
        </div>

        {/* Card */}
        <form onSubmit={handleImport} style={{
          background: "#112236",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: "14px",
          padding: "1.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}>
          {/* Heading */}
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "0.375rem", color: "#F5F0E8" }}>
              Import your games
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#8FA3B8" }}>
              Select a platform and configure your filters.
            </p>
          </div>

          {/* Platform */}
          <div>
            <SectionLabel>Platform</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.625rem" }}>
              {([
                {
                  id: "chesscom" as Platform,
                  name: "Chess.com",
                  logo: (
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <rect width="28" height="28" rx="7" fill="#81B64C"/>
                      <text x="14" y="20" textAnchor="middle" fill="white" fontSize="16" fontWeight="800" fontFamily="Cabinet Grotesk, sans-serif">C</text>
                    </svg>
                  ),
                },
              ] as const).map((p) => {
                const selected = platform === p.id;
                return (
                  <button key={p.id} type="button" onClick={() => setPlatform(p.id)} style={{
                    display: "flex", alignItems: "center", gap: "0.625rem",
                    padding: "0.75rem 1rem",
                    background: selected ? "#1A2E45" : "#112236",
                    border: selected ? "2px solid #2563EB" : "1px solid rgba(255,255,255,0.09)",
                    borderRadius: "10px", cursor: "pointer",
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                    fontSize: "0.9375rem", fontWeight: 600,
                    color: selected ? "#F5F0E8" : "#8FA3B8",
                    transition: "all 0.12s",
                  }}>
                    {p.logo}
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Username */}
          <div>
            <label style={{
              display: "block", fontSize: "0.6875rem", fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase", color: "#8FA3B8", marginBottom: "0.5rem",
            }}>Username</label>
            <input
              placeholder="Your Chess.com username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{ width: "100%" }}
            />
          </div>

          {/* Filters */}
          <div>
            <SectionLabel>Filters</SectionLabel>
            <div style={{ border: "1px solid rgba(255,255,255,0.09)", borderRadius: "10px", overflow: "hidden" }}>

              <FilterRow label="Date range" last={false}>
                <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={selectStyle}>
                  <option value="15d">Last 15 days</option>
                  <option value="1m">Last 1 month</option>
                  <option value="2m">Last 2 months</option>
                  <option value="3m">Last 3 months</option>
                  <option value="6m">Last 6 months</option>
                  <option value="1y">Last 1 year</option>
                  <option value="all">All time</option>
                </select>
              </FilterRow>

              <FilterRow label="Game type" last={false}>
                <select value={gameType} onChange={(e) => handleGameTypeChange(e.target.value as GameType)} style={selectStyle}>
                  {GAME_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </FilterRow>

              <FilterRow label="Time control" last={true}>
                <select value={timeControl} onChange={(e) => setTimeControl(e.target.value)} style={selectStyle}>
                  <option value="all">All</option>
                  {tcGroups.map((grp) =>
                    grp.group ? (
                      <optgroup key={grp.group} label={grp.group}>
                        {grp.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </optgroup>
                    ) : (
                      grp.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
                    )
                  )}
                </select>
              </FilterRow>

            </div>
          </div>

          {/* Info box */}
          <div style={{
            display: "flex", gap: "0.625rem",
            background: "rgba(212,168,67,0.08)", border: "1px solid rgba(212,168,67,0.2)",
            borderRadius: "8px", padding: "0.75rem 0.875rem",
          }}>
            <span style={{ fontSize: "0.9rem", flexShrink: 0 }}>⚠️</span>
            <p style={{ fontSize: "0.8125rem", color: "#D4A843", lineHeight: 1.5, margin: 0 }}>
              We recommend at least 100 games for reliable pattern detection.
            </p>
          </div>

          {/* Error */}
          {error && (
            <p style={{
              fontSize: "0.875rem", color: "#f87171",
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
              borderRadius: "6px", padding: "0.5rem 0.75rem", margin: 0,
            }}>{error}</p>
          )}

          {/* Submit */}
          <button type="submit" disabled={isLoading} style={{
            width: "100%", padding: "0.75rem",
            fontSize: "0.875rem", fontWeight: 700,
            background: jobStatus?.status === "done" ? "#059669" : "#2563EB",
            color: "#fff",
            border: "none", borderRadius: "8px",
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading && jobStatus?.status !== "done" ? 0.7 : 1,
            fontFamily: "'Cabinet Grotesk', sans-serif",
            transition: "background 0.3s",
          }}>
            {isLoading ? loadingLabel() : "Start import"}
          </button>
        </form>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "block", fontSize: "0.6875rem", fontWeight: 700,
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: "#8FA3B8", marginBottom: "0.625rem",
    }}>{children}</span>
  );
}

function FilterRow({ label, last, children }: { label: string; last: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0.75rem 1rem",
      borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.07)",
      background: "#112236",
    }}>
      <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#F5F0E8" }}>{label}</span>
      {children}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "6px",
  padding: "0.3125rem 0.5rem",
  fontSize: "0.875rem",
  color: "#F5F0E8",
  background: "#1A2E45",
  fontFamily: "'Cabinet Grotesk', sans-serif",
  outline: "none",
  cursor: "pointer",
  width: "auto",
};
