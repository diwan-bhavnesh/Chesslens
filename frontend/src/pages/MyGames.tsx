import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { useFilterStore } from "../store/filterStore";
import { useAuthStore } from "../store/authStore";
import { useProfileStore } from "../store/profileStore";
import type { Game } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTimeCategory(tc: string | null, variant: string | null): string {
  if (variant === "chess960") return "chess960";
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

function relativeDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  const now = Date.now();
  const diff = now - d.getTime();
  const diffDays = Math.floor(diff / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`;
  const now_ = new Date();
  if (d.getFullYear() !== now_.getFullYear()) {
    return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function userOutcome(game: Game, username: string | null): "win" | "loss" | "draw" {
  const r = game.result;
  if (r === "1/2-1/2") return "draw";
  const userIsWhite = game.white_player?.toLowerCase() === username?.toLowerCase();
  if ((userIsWhite && r === "1-0") || (!userIsWhite && r === "0-1")) return "win";
  return "loss";
}

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ── Filter config ─────────────────────────────────────────────────────────────

const RESULT_OPTS = [
  { value: "all", label: "All" }, { value: "win", label: "Win" },
  { value: "loss", label: "Loss" }, { value: "draw", label: "Draw" },
];
const TYPE_OPTS = [
  { value: "all", label: "All" }, { value: "bullet", label: "Bullet" }, { value: "blitz", label: "Blitz" },
  { value: "rapid", label: "Rapid" }, { value: "classical", label: "Classical" }, { value: "chess960", label: "Chess960" },
];
const DATE_OPTS = [
  { value: "all", label: "All time", days: 0 }, { value: "15d", label: "15 days", days: 15 },
  { value: "1m", label: "1 month", days: 30 }, { value: "3m", label: "3 months", days: 90 },
  { value: "6m", label: "6 months", days: 180 }, { value: "1y", label: "1 year", days: 365 },
];

// ── UI primitives ─────────────────────────────────────────────────────────────

type PillGroup = "result" | "type" | "period";

const PILL_ACTIVE_STYLES: Record<string, Record<string, React.CSSProperties>> = {
  result: {
    win:  { background: "rgba(34,197,94,0.12)",   borderColor: "rgba(34,197,94,0.35)",   color: "#4ADE80" },
    loss: { background: "rgba(239,68,68,0.12)",   borderColor: "rgba(239,68,68,0.35)",   color: "#F87171" },
    draw: { background: "rgba(100,116,139,0.15)", borderColor: "rgba(100,116,139,0.35)", color: "#94A3B8" },
  },
  type: {
    bullet:    { background: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.35)", color: "#FCD34D" },
    blitz:     { background: "rgba(244,63,94,0.12)",  borderColor: "rgba(244,63,94,0.35)",  color: "#FCA5A5" },
    rapid:     { background: "rgba(52,211,153,0.12)", borderColor: "rgba(52,211,153,0.35)", color: "#6EE7B7" },
    classical: { background: "rgba(99,102,241,0.12)", borderColor: "rgba(99,102,241,0.35)", color: "#C7D2FE" },
    chess960:  { background: "rgba(14,165,233,0.12)", borderColor: "rgba(14,165,233,0.35)", color: "#7DD3FC" },
  },
};

const PILL_BASE: React.CSSProperties = {
  padding: "5px 14px", borderRadius: 7, fontSize: "0.75rem", fontWeight: 500,
  cursor: "pointer", border: "1px solid transparent", background: "transparent",
  color: "#4D6A82", transition: "all 0.13s", letterSpacing: "0.1px",
  fontFamily: "'Cabinet Grotesk', sans-serif", whiteSpace: "nowrap",
};
const PILL_DEFAULT_ACTIVE: React.CSSProperties = {
  background: "#1A2E45", borderColor: "rgba(255,255,255,0.14)", color: "#F5F0E8",
};

function Pill({ active, onClick, children, group, value }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
  group?: PillGroup; value?: string;
}) {
  const activeStyle = group && value && PILL_ACTIVE_STYLES[group]?.[value]
    ? PILL_ACTIVE_STYLES[group][value]
    : PILL_DEFAULT_ACTIVE;
  return (
    <button type="button" onClick={onClick}
      style={{ ...PILL_BASE, ...(active ? activeStyle : {}) }}>
      {children}
    </button>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: "0.5625rem", fontWeight: 700, color: "#4D6A82",
      textTransform: "uppercase", letterSpacing: "1.2px",
      whiteSpace: "nowrap", width: 46, flexShrink: 0, lineHeight: 1,
    }}>{children}</span>
  );
}

function Divider({ vertical }: { vertical?: boolean }) {
  return <div style={vertical
    ? { width: 1, height: 20, background: "rgba(255,255,255,0.07)", flexShrink: 0 }
    : { height: 1, background: "rgba(255,255,255,0.07)" }
  } />;
}

function FiltersBar() {
  const { result, gameType, dateKey, setResult, setGameType, setDateKey, clearFilters } = useFilterStore();
  const hasFilters = result !== "all" || gameType !== "all" || dateKey !== "all";
  const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "2rem" };
  const groupStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6 };
  return (
    <div style={{
      background: "#132840", borderRadius: 12, padding: "1rem 1.75rem",
      marginBottom: "1rem", boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
      display: "flex", flexDirection: "column", gap: "0.75rem",
    }}>
      {/* Row 1: Result + Type */}
      <div style={rowStyle}>
        <div style={groupStyle}>
          <FilterLabel>Result</FilterLabel>
          {RESULT_OPTS.map(o => (
            <Pill key={o.value} active={result === o.value} onClick={() => setResult(o.value)} group="result" value={o.value}>
              {o.label}
            </Pill>
          ))}
        </div>
        <Divider vertical />
        <div style={groupStyle}>
          <FilterLabel>Type</FilterLabel>
          {TYPE_OPTS.map(o => (
            <Pill key={o.value} active={gameType === o.value} onClick={() => setGameType(o.value)} group="type" value={o.value}>
              {o.label}
            </Pill>
          ))}
        </div>
      </div>
      {/* Row 2: Period + Clear */}
      <div style={{ ...rowStyle, justifyContent: "space-between" }}>
        <div style={groupStyle}>
          <FilterLabel>Period</FilterLabel>
          {DATE_OPTS.map(o => (
            <Pill key={o.value} active={dateKey === o.value} onClick={() => setDateKey(o.value)}>
              {o.label}
            </Pill>
          ))}
        </div>
        {hasFilters && (
          <button type="button" onClick={clearFilters} style={{
            fontSize: "0.75rem", fontWeight: 500, fontFamily: "'Cabinet Grotesk', sans-serif",
            padding: "5px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.09)",
            background: "transparent", color: "#8FA3B8", cursor: "pointer",
          }}>Clear all</button>
        )}
      </div>
    </div>
  );
}

// ── Stats strip ───────────────────────────────────────────────────────────────

function StatsStrip({ total, wins, draws, losses, dateRange }: {
  total: number; wins: number; draws: number; losses: number; dateRange: string;
}) {
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const r = 26;
  const circ = 2 * Math.PI * r; // ≈ 163.4
  const offset = circ - (winRate / 100) * circ;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 1px 1fr 1px auto",
      background: "#132840", borderRadius: 12, marginBottom: "1.25rem",
      boxShadow: "0 1px 4px rgba(0,0,0,0.35)", overflow: "hidden",
    }}>
      {/* Total */}
      <div style={{ padding: "1.25rem 1.5rem 1.25rem 2rem", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
        <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1, letterSpacing: "-1px", color: "#F5F0E8", fontVariantNumeric: "tabular-nums" }}>{total}</div>
        <div style={{ fontSize: "0.625rem", color: "#4D6A82", textTransform: "uppercase", letterSpacing: "0.8px", marginTop: 4 }}>Games</div>
        {dateRange && <div style={{ fontSize: "0.6875rem", color: "#4D6A82", marginTop: 6 }}>{dateRange}</div>}
      </div>

      {/* Vertical divider */}
      <div style={{ background: "rgba(255,255,255,0.06)", margin: "1rem 0" }} />

      {/* W/D/L + bar */}
      <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "1.5rem" }}>
          {[
            { n: wins,   l: "W", c: "#22C55E" },
            { n: draws,  l: "D", c: "#4D6A82" },
            { n: losses, l: "L", c: "#EF4444" },
          ].map(({ n, l, c }) => (
            <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontSize: "1.25rem", fontWeight: 700, lineHeight: 1, color: c, fontVariantNumeric: "tabular-nums" }}>{n}</span>
              <span style={{ fontSize: "0.625rem", color: "#4D6A82", textTransform: "uppercase", letterSpacing: "0.6px" }}>{l}</span>
            </div>
          ))}
        </div>
        <div style={{ height: 6, borderRadius: 3, overflow: "hidden", display: "flex", gap: 2, maxWidth: 400 }}>
          {total > 0 && <>
            <div style={{ background: "#22C55E", flex: wins, borderRadius: 3, minWidth: wins > 0 ? 3 : 0 }} />
            <div style={{ background: "#4D6A82", flex: draws, borderRadius: 3, minWidth: draws > 0 ? 3 : 0 }} />
            <div style={{ background: "#EF4444", flex: losses, borderRadius: 3, minWidth: losses > 0 ? 3 : 0 }} />
          </>}
        </div>
      </div>

      {/* Vertical divider */}
      <div style={{ background: "rgba(255,255,255,0.06)", margin: "1rem 0" }} />

      {/* Win rate ring */}
      <div style={{ padding: "1.25rem 2rem 1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1.25rem" }}>
        <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
          <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
            <circle cx="32" cy="32" r={r} fill="none" stroke="#22C55E" strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#22C55E", lineHeight: 1 }}>{winRate}%</span>
            <span style={{ fontSize: "0.4375rem", color: "#4D6A82", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 2 }}>Win</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#F5F0E8" }}>Win Rate</div>
          <div style={{ fontSize: "0.6875rem", color: "#4D6A82", marginTop: 3 }}>Last {total} games</div>
        </div>
      </div>
    </div>
  );
}

// ── Sort toolbar ──────────────────────────────────────────────────────────────

function SortToolbar({ total, page, pageSize }: { total: number; page: number; pageSize: number }) {
  const { sortBy, sortDir, setSortBy, setSortDir } = useFilterStore();

  function handleSort(key: "date" | "accuracy" | "result") {
    if (sortBy === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  }

  const arrow = (key: string) => sortBy === key ? (sortDir === "desc" ? " ↓" : " ↑") : "";
  const sortBtnStyle = (key: string): React.CSSProperties => ({
    padding: "3px 9px", borderRadius: 5, fontSize: "0.6875rem", cursor: "pointer",
    border: "1px solid transparent", background: "transparent",
    fontFamily: "'Cabinet Grotesk', sans-serif",
    color: sortBy === key ? "#F5F0E8" : "#4D6A82", transition: "all 0.12s",
    ...(sortBy === key ? { background: "#132840", borderColor: "rgba(255,255,255,0.1)" } : {}),
  });
  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, total);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0 0.625rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.6875rem", color: "#4D6A82" }}>
        <span>Sort</span>
        <button style={sortBtnStyle("date")}     onClick={() => handleSort("date")}>Date{arrow("date")}</button>
        <button style={sortBtnStyle("accuracy")} onClick={() => handleSort("accuracy")}>Accuracy{arrow("accuracy")}</button>
        <button style={sortBtnStyle("result")}   onClick={() => handleSort("result")}>Result{arrow("result")}</button>
      </div>
      <span style={{ fontSize: "0.6875rem", color: "#4D6A82" }}>
        {total > 0 ? `${start}–${end} of ${total} games` : "0 games"}
      </span>
    </div>
  );
}

// ── Chip components ───────────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, { color: string; bg: string; dot: string }> = {
  bullet:    { color: "#FCD34D", bg: "rgba(251,191,36,0.1)",  dot: "#F59E0B" },
  blitz:     { color: "#FCA5A5", bg: "rgba(244,63,94,0.1)",   dot: "#F43F5E" },
  rapid:     { color: "#6EE7B7", bg: "rgba(52,211,153,0.1)",  dot: "#34D399" },
  classical: { color: "#C7D2FE", bg: "rgba(99,102,241,0.1)",  dot: "#818CF8" },
  chess960:  { color: "#7DD3FC", bg: "rgba(14,165,233,0.1)",  dot: "#38BDF8" },
};

function TypeChip({ tc, variant }: { tc: string | null; variant: string | null }) {
  const cat = getTimeCategory(tc, variant);
  const s = TYPE_STYLES[cat];
  if (!s) return <span style={{ color: "#4D6A82" }}>—</span>;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 8px", borderRadius: 5, fontSize: "0.6875rem", fontWeight: 500,
      background: s.bg, color: s.color,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {cat === "chess960" ? "Chess960" : cat.charAt(0).toUpperCase() + cat.slice(1)}
    </span>
  );
}

function ResultBadge({ outcome }: { outcome: "win" | "loss" | "draw" }) {
  const s = {
    win:  { label: "Win",  color: "#4ADE80", bg: "rgba(34,197,94,0.12)"    },
    loss: { label: "Loss", color: "#F87171", bg: "rgba(239,68,68,0.12)"    },
    draw: { label: "Draw", color: "#94A3B8", bg: "rgba(100,116,139,0.15)"  },
  }[outcome];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 9px",
      borderRadius: 5, fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.2px",
      background: s.bg, color: s.color,
    }}>{s.label}</span>
  );
}

function AccuracyCell({ pct, isBulk }: { pct: number | null | undefined; isBulk: boolean }) {
  if (pct == null) return <span style={{ color: "#4D6A82", fontSize: "0.75rem" }}>—</span>;
  const color = pct >= 80 ? "#4ADE80" : pct >= 60 ? "#F5F0E8" : "#F87171";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color }}>{Math.round(pct)}%</span>
        {isBulk && <span style={{ fontSize: "0.625rem", color: "#4D6A82" }} title="Bulk analysis — run Analyze for exact value">~</span>}
      </div>
      <div style={{ width: 48, height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: color, opacity: 0.7 }} />
      </div>
    </div>
  );
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

function MiniSpinner() {
  return (
    <div style={{
      width: 10, height: 10, flexShrink: 0,
      border: "1.5px solid rgba(143,163,184,0.25)",
      borderTopColor: "#8FA3B8",
      borderRadius: "50%",
      display: "inline-block",
      animation: "spin 0.75s linear infinite",
    }} />
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

function Pagination({ page, totalPages, onPage }: {
  page: number; totalPages: number; onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pgBtnStyle = (active: boolean, disabled?: boolean): React.CSSProperties => ({
    minWidth: 30, height: 30, padding: "0 8px", borderRadius: 6,
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem",
    cursor: disabled ? "default" : "pointer",
    border: "1px solid rgba(255,255,255,0.08)", background: "transparent",
    fontFamily: "'Cabinet Grotesk', sans-serif",
    color: disabled ? "#4D6A82" : active ? "#F5F0E8" : "#4D6A82",
    ...(active ? { background: "rgba(37,99,235,0.2)", borderColor: "rgba(37,99,235,0.5)" } : {}),
  });
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, padding: "1.25rem 0 0.25rem" }}>
      <button style={pgBtnStyle(false, page === 0)} disabled={page === 0} onClick={() => onPage(page - 1)}>←</button>
      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
        <button key={i} style={pgBtnStyle(i === page)} onClick={() => onPage(i)}>{i + 1}</button>
      ))}
      <button style={pgBtnStyle(false, page === totalPages - 1)} disabled={page === totalPages - 1} onClick={() => onPage(page + 1)}>→</button>
    </div>
  );
}

// ── Game table ────────────────────────────────────────────────────────────────

const COL = "200px 80px 105px 1fr 100px 120px 68px 40px";

function GameRow({ game, username, onDelete, onAnalyze, onReview, isAwaitingReview }: {
  game: Game; username: string | null;
  onDelete: (id: string) => void; onAnalyze: (id: string) => void;
  onReview: (id: string) => void; isAwaitingReview: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isAwaitingReview) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isAwaitingReview]);
  const outcome = game.result != null ? userOutcome(game, username) : null;
  const userIsWhite = game.white_player?.toLowerCase() === username?.toLowerCase();
  const opponent = userIsWhite ? game.black_player : game.white_player;
  const oppElo   = userIsWhite ? game.black_elo  : game.white_elo;
  const isPending = game.analysis?.status === "pending";
  const isDone    = game.analysis?.status === "done";
  const isBulkDepth = isDone; // once we ship depth-5 bulk, all bulk results show tilde

  const userAccuracy = isDone
    ? (userIsWhite ? game.analysis?.accuracy_white : game.analysis?.accuracy_black)
    : null;

  const accentColor = outcome === "win" ? "#22C55E" : outcome === "loss" ? "#EF4444" : "#4D6A82";
  const avatarIsBlack = !userIsWhite;

  return (
    <div style={{ position: "relative", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.1s" }}
      onMouseEnter={e => (e.currentTarget.style.background = "#1E3550")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {/* left accent */}
      {outcome && (
        <div style={{
          position: "absolute", left: 0, top: 6, bottom: 6, width: 3,
          borderRadius: "0 2px 2px 0", background: accentColor,
        }} />
      )}
      <div style={{ display: "grid", gridTemplateColumns: COL, alignItems: "center", padding: "0.7rem 1.25rem 0.7rem 0" }}>

        {/* Opponent */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: "1.25rem" }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.6875rem", fontWeight: 700,
            background: avatarIsBlack ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.08)",
            color: avatarIsBlack ? "#93C5FD" : "#F5F0E8",
          }}>
            {initials(opponent)}
          </div>
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#F5F0E8", lineHeight: 1.2, display: "flex", alignItems: "center", gap: 5 }}>
              {opponent ?? "Unknown"}
              <span style={{
                display: "inline-block", width: 7, height: 7, borderRadius: 2, flexShrink: 0,
                background: userIsWhite ? "#E2E8F0" : "#2563EB",
                border: userIsWhite ? "1px solid rgba(255,255,255,0.3)" : "1px solid #3B82F6",
                opacity: 0.85,
              }} title={userIsWhite ? "You played White" : "You played Black"} />
            </div>
            {oppElo != null && (
              <div style={{ fontSize: "0.625rem", color: "#4D6A82", marginTop: 1 }}>{oppElo}</div>
            )}
          </div>
        </div>

        {/* Result */}
        <div>{outcome ? <ResultBadge outcome={outcome} /> : <span style={{ color: "#4D6A82" }}>—</span>}</div>

        {/* Type */}
        <div><TypeChip tc={game.time_control} variant={game.variant} /></div>

        {/* Opening */}
        <div style={{ fontSize: "0.75rem", color: "#8FA3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>
          {game.opening ?? <span style={{ color: "#4D6A82" }}>—</span>}
        </div>

        {/* Date */}
        <div style={{ fontSize: "0.6875rem", color: "#4D6A82" }}>{relativeDate(game.played_at ?? game.created_at)}</div>

        {/* Accuracy */}
        <div>
          {isPending ? (
            <span style={{ fontSize: "0.75rem", color: "#2563EB", display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <Spinner /> Analysing…
            </span>
          ) : (
            <AccuracyCell pct={userAccuracy ?? undefined} isBulk={isBulkDepth} />
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isDone && isAwaitingReview ? (
            <span style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              fontSize: "0.6875rem", color: "#8FA3B8", whiteSpace: "nowrap",
            }}>
              <MiniSpinner /> Preparing… {elapsed}s
            </span>
          ) : isDone ? (
            <button
              onClick={() => onReview(game.id)}
              style={{
                padding: "4px 10px", borderRadius: 5, fontSize: "0.6875rem", fontWeight: 500,
                background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
                color: "#8FA3B8", cursor: "pointer", whiteSpace: "nowrap",
                fontFamily: "'Cabinet Grotesk', sans-serif",
              }}
            >Review</button>
          ) : !isPending ? (
            <button onClick={() => onAnalyze(game.id)} style={{
              padding: "4px 10px", borderRadius: 5, fontSize: "0.6875rem", fontWeight: 500,
              background: "transparent", border: "1px solid #2563EB", color: "#2563EB",
              cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Cabinet Grotesk', sans-serif",
            }}>Analyze</button>
          ) : null}
        </div>

        {/* Delete */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {confirmDelete ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.6875rem", color: "#8FA3B8", whiteSpace: "nowrap" }}>
              <button onClick={() => onDelete(game.id)} style={{
                padding: "2px 7px", borderRadius: 4, fontSize: "0.625rem",
                background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)",
                color: "#F87171", cursor: "pointer", fontFamily: "'Cabinet Grotesk', sans-serif",
              }}>Yes</button>
              <button onClick={() => setConfirmDelete(false)} style={{
                padding: "2px 7px", borderRadius: 4, fontSize: "0.625rem",
                background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                color: "#4D6A82", cursor: "pointer", fontFamily: "'Cabinet Grotesk', sans-serif",
              }}>No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} title="Delete" style={{
              width: 28, height: 28, padding: 0, display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid transparent", borderRadius: 5,
              background: "transparent", color: "#4D6A82", cursor: "pointer",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.3)"; (e.currentTarget as HTMLButtonElement).style.color = "#F87171"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#4D6A82"; }}
            >
              <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
                <path d="M5 1h5M1 3.5h13M12 3.5l-.8 8.5a1 1 0 01-1 .9H4.8a1 1 0 01-1-.9L3 3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GameTable({ games, username, onDelete, onAnalyze, onReview, awaitingReviewId }: {
  games: Game[]; username: string | null;
  onDelete: (id: string) => void; onAnalyze: (id: string) => void;
  onReview: (id: string) => void; awaitingReviewId: string | null;
}) {
  if (games.length === 0) return null;
  const hdrStyle: React.CSSProperties = {
    fontSize: "0.5625rem", fontWeight: 600, color: "#4D6A82",
    textTransform: "uppercase", letterSpacing: "1px",
  };
  return (
    <div style={{ background: "#132840", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.35)" }}>
      <div style={{ display: "grid", gridTemplateColumns: COL, padding: "9px 1.25rem 9px 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {["Opponent", "Result", "Type", "Opening", "Date", "Accuracy", "", ""].map((h, i) => (
          <span key={i} style={hdrStyle}>{h}</span>
        ))}
      </div>
      {games.map(game => (
        <GameRow
          key={game.id}
          game={game}
          username={username}
          onDelete={onDelete}
          onAnalyze={onAnalyze}
          onReview={onReview}
          isAwaitingReview={awaitingReviewId === game.id}
        />
      ))}
    </div>
  );
}

// ── My Games page ─────────────────────────────────────────────────────────────

export function MyGames() {
  const { games, isLoading, fetchGames, deleteGame, triggerAnalysis, refreshGameInList } = useGameStore();
  const { result, gameType, dateKey, sortBy, sortDir, clearFilters } = useFilterStore();
  const { user } = useAuthStore();
  const { profile } = useProfileStore();
  const navigate = useNavigate();
  const username = user?.chesscom_username ?? null;

  const layer2Running = !!(
    profile &&
    profile.status === "done" &&
    profile.games_total != null &&
    !(
      (profile.accuracy_history?.length ?? 0) > 0 &&
      profile.phase_accuracy?.opening != null &&
      profile.time_pressure?.normal_accuracy != null
    )
  );

  const [page, setPage] = useState(0);
  const [awaitingReviewId, setAwaitingReviewId] = useState<string | null>(null);
  const reviewReadyRef = useRef(false); // true only after trigger+refresh complete
  const gamePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingIdsRef = useRef<string[]>([]);

  useEffect(() => { fetchGames(); }, []);

  const handleAnalyze = useCallback(async (id: string) => {
    await triggerAnalysis(id);
    refreshGameInList(id);
  }, [triggerAnalysis, refreshGameInList]);

  const handleReview = useCallback(async (id: string) => {
    reviewReadyRef.current = false;
    setAwaitingReviewId(id);
    await triggerAnalysis(id);
    await refreshGameInList(id);
    reviewReadyRef.current = true;
    // Direct store read (Zustand sync): if backend returned "done" immediately, navigate now
    const game = useGameStore.getState().games.find(g => g.id === id);
    if (game?.analysis?.status === "done") {
      navigate(`/game/${id}`);
      setAwaitingReviewId(null);
    }
  }, [triggerAnalysis, refreshGameInList, navigate]);

  // Navigate when polling detects the awaited analysis is done
  useEffect(() => {
    if (!awaitingReviewId || !reviewReadyRef.current) return;
    const game = games.find(g => g.id === awaitingReviewId);
    if (game?.analysis?.status === "done") {
      navigate(`/game/${awaitingReviewId}`);
      setAwaitingReviewId(null);
    }
  }, [games, awaitingReviewId, navigate]);

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
    const f = games.filter((g: Game) => {
      if (result !== "all") {
        const outcome = g.result != null ? userOutcome(g, username) : null;
        if (outcome !== result) return false;
      }
      if (gameType !== "all" && getTimeCategory(g.time_control, g.variant) !== gameType) return false;
      if (dateDays > 0 && !isWithinDays(g.played_at ?? g.created_at, dateDays)) return false;
      return true;
    });

    return f.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") {
        const da = new Date(a.played_at ?? a.created_at).getTime();
        const db = new Date(b.played_at ?? b.created_at).getTime();
        cmp = da - db;
      } else if (sortBy === "accuracy") {
        const userIsWhiteA = a.white_player?.toLowerCase() === username?.toLowerCase();
        const userIsWhiteB = b.white_player?.toLowerCase() === username?.toLowerCase();
        const accA = userIsWhiteA ? (a.analysis?.accuracy_white ?? -1) : (a.analysis?.accuracy_black ?? -1);
        const accB = userIsWhiteB ? (b.analysis?.accuracy_white ?? -1) : (b.analysis?.accuracy_black ?? -1);
        cmp = accA - accB;
      } else if (sortBy === "result") {
        const rank = { win: 2, draw: 1, loss: 0 };
        const ra = a.result != null ? rank[userOutcome(a, username)] : -1;
        const rb = b.result != null ? rank[userOutcome(b, username)] : -1;
        cmp = ra - rb;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [games, result, gameType, dateDays, sortBy, sortDir, username]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Stats computed from ALL filtered games (user-relative)
  const wins   = filtered.filter(g => g.result != null && userOutcome(g, username) === "win").length;
  const losses = filtered.filter(g => g.result != null && userOutcome(g, username) === "loss").length;
  const draws  = filtered.filter(g => g.result != null && userOutcome(g, username) === "draw").length;
  const hasFilters = result !== "all" || gameType !== "all" || dateKey !== "all";

  // Date range label for stats strip
  const datesWithGames = filtered.map(g => g.played_at ?? g.created_at).filter(Boolean) as string[];
  let dateRange = "";
  if (datesWithGames.length > 1) {
    const sorted = [...datesWithGames].sort();
    const fmt = (s: string) => new Date(s).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    dateRange = `${fmt(sorted[0])} – ${fmt(sorted[sorted.length - 1])}`;
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "1.75rem 2rem 5rem", background: "#0D1B2A" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{
            fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.3px",
            color: "#F5F0E8", marginBottom: 2,
          }}>My Games</h1>
          {!isLoading && games.length > 0 && (
            <p style={{ fontSize: "0.75rem", color: "#4D6A82" }}>
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
          <StatsStrip total={filtered.length} wins={wins} draws={draws} losses={losses} dateRange={dateRange} />

          {layer2Running && (
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              background: "rgba(37,99,235,0.08)",
              border: "1px solid rgba(37,99,235,0.2)",
              borderRadius: 10,
              padding: "0.75rem 1rem",
              marginBottom: "0.25rem",
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: "#2563EB", flexShrink: 0, marginTop: 5,
                boxShadow: "0 0 6px #2563EB",
                animation: "pulse 1.8s ease-in-out infinite",
              }} />
              <div>
                <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#F5F0E8" }}>
                  Stockfish is scoring your games
                </p>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.8125rem", color: "#8FA3B8", lineHeight: 1.5 }}>
                  Accuracy percentages fill in as each position is evaluated
                  {profile?.games_total ? ` — ${profile.games_total.toLocaleString()} games takes a few minutes` : ""}.
                  Filters and sorting work on all available data in the meantime.
                </p>
              </div>
            </div>
          )}

          <FiltersBar />

          {filtered.length === 0 && hasFilters ? (
            <div style={{ textAlign: "center", padding: "3rem 2rem", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, background: "#132840" }}>
              <p style={{ fontWeight: 600, marginBottom: "0.4rem", color: "#F5F0E8" }}>No games match these filters</p>
              <button className="btn-ghost" onClick={clearFilters} style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>Clear filters</button>
            </div>
          ) : (
            <>
              <SortToolbar total={filtered.length} page={page} pageSize={PAGE_SIZE} />
              <GameTable games={paginated} username={username} onDelete={deleteGame} onAnalyze={handleAnalyze} onReview={handleReview} awaitingReviewId={awaitingReviewId} />
              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </>
          )}
        </>
      )}
    </div>
  );
}
