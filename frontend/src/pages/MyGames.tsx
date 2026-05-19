import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { useFilterStore } from "../store/filterStore";
import type { Game } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTimeCategory(tc: string | null) {
  if (!tc) return "other";
  const [b = "0", i = "0"] = tc.split("+");
  const tot = parseInt(b) + parseInt(i) * 40;
  if (tot < 180)  return "bullet";
  if (tot < 480)  return "blitz";
  if (tot < 1500) return "rapid";
  return "classical";
}

function isWithinDays(dateStr: string | null, days: number) {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() >= Date.now() - days * 86_400_000;
}

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Filter config ─────────────────────────────────────────────────────────────

const PLATFORM_OPTS = [
  { value: "all", label: "All" }, { value: "chesscom", label: "Chess.com" },
];
const RESULT_OPTS = [
  { value: "all", label: "All" }, { value: "1-0", label: "White wins" },
  { value: "0-1", label: "Black wins" }, { value: "1/2-1/2", label: "Draw" },
];
const TYPE_OPTS = [
  { value: "all", label: "All" }, { value: "bullet", label: "Bullet" }, { value: "blitz", label: "Blitz" },
  { value: "rapid", label: "Rapid" }, { value: "classical", label: "Classical" },
];
const DATE_OPTS = [
  { value: "all", label: "All time", days: 0 }, { value: "15d", label: "15 days", days: 15 },
  { value: "1m", label: "1 month", days: 30 }, { value: "3m", label: "3 months", days: 90 },
  { value: "6m", label: "6 months", days: 180 }, { value: "1y", label: "1 year", days: 365 },
];

// ── UI primitives ─────────────────────────────────────────────────────────────

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      fontSize: "0.8125rem", fontWeight: active ? 600 : 500,
      fontFamily: "'Cabinet Grotesk', sans-serif",
      padding: "0.3rem 0.7rem", borderRadius: "99px",
      border: active ? "1.5px solid #2563EB" : "1px solid rgba(255,255,255,0.09)",
      background: active ? "#1A2E45" : "transparent",
      color: active ? "#F5F0E8" : "#8FA3B8",
      cursor: "pointer", transition: "all 0.12s", whiteSpace: "nowrap", lineHeight: 1.4,
    }}>
      {children}
    </button>
  );
}

function FilterGroup({ label, opts, value, onChange }: {
  label: string; opts: { value: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#4D6A82", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {opts.map(o => <Pill key={o.value} active={value === o.value} onClick={() => onChange(o.value)}>{o.label}</Pill>)}
    </div>
  );
}

function FiltersBar() {
  const { platform, result, gameType, dateKey, setPlatform, setResult, setGameType, setDateKey, clearFilters } = useFilterStore();
  const hasFilters = platform !== "all" || result !== "all" || gameType !== "all" || dateKey !== "all";
  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, background: "#112236",
      padding: "1rem 1.25rem", marginBottom: "1.5rem",
      display: "flex", flexDirection: "column", gap: "0.75rem",
    }}>
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
        <FilterGroup label="Platform" opts={PLATFORM_OPTS} value={platform} onChange={setPlatform} />
        <div style={{ width: 1, background: "rgba(255,255,255,0.07)", alignSelf: "stretch" }} />
        <FilterGroup label="Result"   opts={RESULT_OPTS}   value={result}   onChange={setResult}   />
      </div>
      <div style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <FilterGroup label="Type"   opts={TYPE_OPTS} value={gameType} onChange={setGameType} />
        <div style={{ width: 1, background: "rgba(255,255,255,0.07)", alignSelf: "stretch" }} />
        <FilterGroup label="Period" opts={DATE_OPTS} value={dateKey}  onChange={setDateKey}  />
        {hasFilters && (
          <button type="button" onClick={clearFilters} style={{
            marginLeft: "auto", fontSize: "0.8125rem", fontWeight: 500,
            fontFamily: "'Cabinet Grotesk', sans-serif",
            padding: "0.3rem 0.75rem", borderRadius: "99px",
            border: "1px solid rgba(255,255,255,0.09)", background: "#112236", color: "#8FA3B8", cursor: "pointer",
          }}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

function ResultChip({ result }: { result: string | null }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    "1-0":     { label: "1-0", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
    "0-1":     { label: "0-1", color: "#f87171", bg: "rgba(248,113,113,0.12)" },
    "1/2-1/2": { label: "½-½", color: "#8FA3B8", bg: "rgba(143,163,184,0.12)" },
  };
  if (!result || !map[result]) return <span style={{ color: "#4D6A82" }}>—</span>;
  const { label, color, bg } = map[result];
  return <span style={{ display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: 5, fontSize: "0.75rem", fontWeight: 700, color, background: bg }}>{label}</span>;
}

function TypeChip({ tc }: { tc: string | null }) {
  const cat = getTimeCategory(tc);
  if (cat === "other") return <span style={{ color: "#4D6A82" }}>—</span>;
  const colors: Record<string, { color: string; bg: string }> = {
    bullet:    { color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
    blitz:     { color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
    rapid:     { color: "#34d399", bg: "rgba(52,211,153,0.12)" },
    classical: { color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  };
  const { color, bg } = colors[cat] ?? { color: "#8FA3B8", bg: "rgba(143,163,184,0.12)" };
  return <span style={{ display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: 5, fontSize: "0.75rem", fontWeight: 600, color, background: bg, textTransform: "capitalize" }}>{cat}</span>;
}

function Spinner() {
  return (
    <span className="spin" style={{ display: "inline-block", width: 14, height: 14, verticalAlign: "middle" }}>
      <svg viewBox="0 0 14 14" fill="none" width="14" height="14">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25"/>
        <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </span>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

function Pagination({ page, totalPages, total, onPage }: {
  page: number; totalPages: number; total: number; onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const start = page * PAGE_SIZE + 1;
  const end   = Math.min((page + 1) * PAGE_SIZE, total);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1rem", padding: "0 0.25rem" }}>
      <span style={{ fontSize: "0.8125rem", color: "#8FA3B8" }}>{start}–{end} of {total} games</span>
      <div style={{ display: "flex", gap: "0.375rem" }}>
        <button onClick={() => onPage(page - 1)} disabled={page === 0} style={{
          fontSize: "0.8125rem", fontFamily: "'Cabinet Grotesk', sans-serif",
          padding: "0.3rem 0.75rem", borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.09)", background: "#112236",
          color: page === 0 ? "#4D6A82" : "#2563EB", cursor: page === 0 ? "default" : "pointer",
        }}>← Prev</button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
          <button key={i} onClick={() => onPage(i)} style={{
            fontSize: "0.8125rem", fontFamily: "'Cabinet Grotesk', sans-serif",
            padding: "0.3rem 0.625rem", borderRadius: 6, minWidth: 32,
            border: i === page ? "1.5px solid #2563EB" : "1px solid rgba(255,255,255,0.09)",
            background: i === page ? "#1A2E45" : "#112236",
            color: i === page ? "#F5F0E8" : "#8FA3B8",
            cursor: "pointer", fontWeight: i === page ? 700 : 400,
          }}>{i + 1}</button>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages - 1} style={{
          fontSize: "0.8125rem", fontFamily: "'Cabinet Grotesk', sans-serif",
          padding: "0.3rem 0.75rem", borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.09)", background: "#112236",
          color: page === totalPages - 1 ? "#4D6A82" : "#2563EB", cursor: page === totalPages - 1 ? "default" : "pointer",
        }}>Next →</button>
      </div>
    </div>
  );
}

// ── Game table ────────────────────────────────────────────────────────────────

const COL = "minmax(180px, 1.5fr) 80px 90px minmax(0, 1fr) 108px 190px";

function GameTable({ games, onDelete, onAnalyze }: {
  games: Game[];
  onDelete: (id: string) => void;
  onAnalyze: (id: string) => void;
}) {
  if (games.length === 0) return null;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: COL, padding: "0 1rem", marginBottom: "0.375rem", gap: "0.75rem" }}>
        {["Players", "Result", "Type", "Opening", "Date", ""].map((h, i) => (
          <span key={i} style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#4D6A82" }}>{h}</span>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
        {games.map((game, i) => {
          const isPending = game.analysis?.status === "pending";
          const isDone    = game.analysis?.status === "done";
          return (
            <div
              key={game.id}
              style={{
                display: "grid", gridTemplateColumns: COL, alignItems: "center",
                gap: "0.75rem", padding: "0.875rem 1rem", background: "#112236",
                borderBottom: i < games.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#1A2E45")}
              onMouseLeave={e => (e.currentTarget.style.background = "#112236")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: 0 }}>
                <div style={{
                  width: 34, height: 34, flexShrink: 0,
                  background: "linear-gradient(135deg, #1E3A5F, #2563EB)",
                  borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.95rem", color: "#fff",
                }}>♟</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9375rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#F5F0E8" }}>
                    {game.white_player ?? "?"} <span style={{ fontWeight: 400, color: "#4D6A82" }}>vs</span> {game.black_player ?? "?"}
                  </div>
                  {(game.white_elo || game.black_elo) && (
                    <div style={{ fontSize: "0.75rem", color: "#8FA3B8", fontVariantNumeric: "tabular-nums" }}>{game.white_elo ?? "?"} — {game.black_elo ?? "?"}</div>
                  )}
                </div>
              </div>
              <div><ResultChip result={game.result} /></div>
              <div><TypeChip tc={game.time_control} /></div>
              <div style={{ fontSize: "0.8125rem", color: "#8FA3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {game.opening ?? <span style={{ color: "#4D6A82" }}>—</span>}
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#8FA3B8", whiteSpace: "nowrap" }}>{formatDate(game.played_at ?? game.created_at)}</div>
              <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end", alignItems: "center" }}>
                {isPending ? (
                  <span style={{ fontSize: "0.8rem", color: "#2563EB", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <Spinner /> Analysing…
                  </span>
                ) : isDone ? (
                  <>
                    <span style={{ fontSize: "0.75rem", color: "#F5F0E8", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {game.analysis?.accuracy_white != null ? `${game.analysis.accuracy_white}%` : "—"}
                    </span>
                    <Link to={`/game/${game.id}`} style={{ textDecoration: "none" }}>
                      <button className="btn-ghost" style={{ fontSize: "0.8rem", padding: "0.3rem 0.625rem", whiteSpace: "nowrap" }}>Review</button>
                    </Link>
                  </>
                ) : (
                  <button
                    onClick={() => onAnalyze(game.id)}
                    style={{
                      fontSize: "0.8rem", padding: "0.3rem 0.625rem", whiteSpace: "nowrap",
                      background: "transparent", border: "1px solid #2563EB", color: "#2563EB",
                      borderRadius: 6, cursor: "pointer", fontFamily: "'Cabinet Grotesk', sans-serif",
                    }}
                  >
                    Run Stockfish
                  </button>
                )}
                <button
                  onClick={() => onDelete(game.id)}
                  title="Delete"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 28, height: 28, padding: 0,
                    border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6,
                    background: "transparent", color: "#f87171", cursor: "pointer", flexShrink: 0,
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
                    <path d="M5 1h5M1 3.5h13M12 3.5l-.8 8.5a1 1 0 01-1 .9H4.8a1 1 0 01-1-.9L3 3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── My Games page ─────────────────────────────────────────────────────────────

export function MyGames() {
  const { games, isLoading, fetchGames, deleteGame, triggerAnalysis, refreshGameInList } = useGameStore();
  const { platform, result, gameType, dateKey, clearFilters } = useFilterStore();
  const [page, setPage] = useState(0);
  const gamePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingIdsRef = useRef<string[]>([]);

  useEffect(() => { fetchGames(); }, []);

  const handleAnalyze = useCallback(async (id: string) => {
    await triggerAnalysis(id);
    refreshGameInList(id);
  }, [triggerAnalysis, refreshGameInList]);

  const hasPendingGame = games.some(g => g.analysis?.status === "pending");
  pendingIdsRef.current = games.filter(g => g.analysis?.status === "pending").map(g => g.id);

  useEffect(() => {
    if (hasPendingGame && !gamePollRef.current) {
      gamePollRef.current = setInterval(() => {
        pendingIdsRef.current.forEach(id => refreshGameInList(id));
      }, 3000);
    } else if (!hasPendingGame && gamePollRef.current) {
      clearInterval(gamePollRef.current);
      gamePollRef.current = null;
    }
    return () => { if (gamePollRef.current) { clearInterval(gamePollRef.current); gamePollRef.current = null; } };
  }, [hasPendingGame]);

  const dateDays = DATE_OPTS.find(d => d.value === dateKey)?.days ?? 0;

  const filtered = useMemo(() => {
    setPage(0);
    return games.filter((g: Game) => {
      if (platform !== "all" && g.source !== platform) return false;
      if (result   !== "all" && g.result !== result)   return false;
      if (gameType !== "all" && getTimeCategory(g.time_control) !== gameType) return false;
      if (dateDays > 0 && !isWithinDays(g.played_at ?? g.created_at, dateDays)) return false;
      return true;
    });
  }, [games, platform, result, gameType, dateDays]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const wins   = filtered.filter(g => g.result === "1-0").length;
  const losses = filtered.filter(g => g.result === "0-1").length;
  const draws  = filtered.filter(g => g.result === "1/2-1/2").length;
  const hasFilters = platform !== "all" || result !== "all" || gameType !== "all" || dateKey !== "all";

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "1.5rem 2rem 5rem", background: "#0D1B2A" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <h1 style={{
            fontSize: "1.875rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "0.25rem",
            background: "linear-gradient(135deg, #F5F0E8 0%, #D4A843 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>My Games</h1>
          {!isLoading && games.length > 0 && (
            <p style={{ fontSize: "0.875rem", color: "#8FA3B8" }}>
              {games.length} game{games.length !== 1 ? "s" : ""} imported
            </p>
          )}
        </div>
        <Link to="/import" style={{ textDecoration: "none" }}>
          <button style={{ fontSize: "0.875rem", padding: "0.5625rem 1.125rem", whiteSpace: "nowrap" }}>+ Import Games</button>
        </Link>
      </div>

      {isLoading && (
        <div style={{ padding: "5rem 0", textAlign: "center", color: "#8FA3B8", fontSize: "0.9rem" }}>
          <Spinner /> &nbsp; Loading your games…
        </div>
      )}

      {!isLoading && games.length === 0 && (
        <div style={{ textAlign: "center", padding: "5rem 2rem" }}>
          <p style={{ fontSize: "1.125rem", fontWeight: 700, color: "#F5F0E8", marginBottom: "0.75rem" }}>No games yet</p>
          <p style={{ fontSize: "0.9rem", color: "#8FA3B8", marginBottom: "1.5rem" }}>Import from Chess.com to get started.</p>
          <Link to="/import" style={{ textDecoration: "none" }}>
            <button style={{ background: "#D4A843", color: "#0D1B2A", fontWeight: 700, padding: "0.75rem 2rem", border: "none" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#C49B35"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#D4A843"; }}
            >Import games</button>
          </Link>
        </div>
      )}

      {!isLoading && games.length > 0 && (
        <>
          {/* Stats strip */}
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
            {[
              { v: filtered.length, l: "Games",  c: "#2563EB", bg: "rgba(37,99,235,0.1)"   },
              { v: wins,            l: "Wins",   c: "#34d399", bg: "rgba(52,211,153,0.1)"  },
              { v: losses,          l: "Losses", c: "#f87171", bg: "rgba(248,113,113,0.1)" },
              { v: draws,           l: "Draws",  c: "#8FA3B8", bg: "rgba(143,163,184,0.1)" },
            ].map(({ v, l, c, bg }) => (
              <div key={l} style={{
                flex: 1, minWidth: 120, background: bg, borderRadius: 14,
                padding: "1.25rem 1.5rem", border: `1px solid ${c}22`, boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
              }}>
                <span style={{ display: "block", fontSize: "2rem", fontWeight: 800, color: c, lineHeight: 1, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{v}</span>
                <span style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, color: c, opacity: 0.65, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: "0.25rem" }}>{l}</span>
              </div>
            ))}
          </div>

          <FiltersBar />

          {filtered.length === 0 && hasFilters ? (
            <div style={{ textAlign: "center", padding: "3rem 2rem", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, background: "#112236" }}>
              <p style={{ fontWeight: 600, marginBottom: "0.4rem", color: "#F5F0E8" }}>No games match these filters</p>
              <button className="btn-ghost" onClick={clearFilters} style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>Clear filters</button>
            </div>
          ) : (
            <>
              <GameTable games={paginated} onDelete={deleteGame} onAnalyze={handleAnalyze} />
              <Pagination page={page} totalPages={totalPages} total={filtered.length} onPage={setPage} />
            </>
          )}
        </>
      )}
    </div>
  );
}
