import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { useFilterStore } from "../store/filterStore";
import type {
  Game, OpeningEntry, TacticalPattern, OpeningRecommendation, PortfolioData,
} from "../types";

// ── helpers ───────────────────────────────────────────────────────────────────

function cleanApiError(raw: string | null): string {
  if (!raw) return "Something went wrong. Please try again.";
  // Extract message field from stringified Python dict / JSON
  const match = raw.match(/'message':\s*'([^']+)'/) ?? raw.match(/"message":\s*"([^"]+)"/);
  if (match) return match[1];
  // Truncate long raw strings
  return raw.length > 120 ? raw.slice(0, 120) + "…" : raw;
}

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

// ── filter config ─────────────────────────────────────────────────────────────

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

// ── design primitives ─────────────────────────────────────────────────────────

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

function StatCard({ value, label, color, bg }: { value: number | string; label: string; color: string; bg: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 120,
      background: bg,
      borderRadius: 14,
      padding: "1.25rem 1.5rem",
      display: "flex", flexDirection: "column", gap: "0.375rem",
      border: `1px solid ${color}22`,
      boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
    }}>
      <span style={{ fontSize: "2rem", fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ fontSize: "0.6875rem", fontWeight: 700, color, opacity: 0.65, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
    </div>
  );
}

function SectionCard({ title, children, action, accentColor }: { title: string; children: React.ReactNode; action?: React.ReactNode; accentColor?: string }) {
  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.08)",
      borderTop: `2.5px solid ${accentColor ?? "#2563EB"}`,
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: "1rem",
      background: "#132840",
      boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.875rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "#1A2E45",
      }}>
        <span style={{ fontWeight: 700, fontSize: "1rem", color: "#F5F0E8", letterSpacing: "-0.01em" }}>{title}</span>
        {action}
      </div>
      <div style={{ padding: "1.125rem 1.25rem" }}>{children}</div>
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

// ── Portfolio display components ──────────────────────────────────────────────

function StyleCard({ style }: { style: PortfolioData["playing_style"] }) {
  const styleMap: Record<string, { color: string; bg: string; label: string }> = {
    aggressive: { color: "#f87171", bg: "rgba(248,113,113,0.1)", label: "Aggressive" },
    defensive:  { color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  label: "Defensive"  },
    positional: { color: "#34d399", bg: "rgba(52,211,153,0.1)",  label: "Positional" },
    tactical:   { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  label: "Tactical"   },
  };
  const { color, bg, label } = styleMap[style.classification] ?? { color: "#2563EB", bg: "rgba(37,99,235,0.1)", label: style.classification };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{
          display: "inline-block", padding: "0.35rem 1rem", borderRadius: 99,
          fontSize: "0.875rem", fontWeight: 700, color, background: bg,
          border: `1px solid ${color}33`,
        }}>
          {label}
        </span>
      </div>
      <p style={{ fontSize: "0.875rem", lineHeight: 1.65, color: "#8FA3B8", margin: 0 }}>{style.description}</p>
    </div>
  );
}

function OpeningTable({ repertoire }: { repertoire: { as_white: OpeningEntry[]; as_black: OpeningEntry[] } }) {
  const [tab, setTab] = useState<"white" | "black">("white");
  const entries = tab === "white" ? repertoire.as_white : repertoire.as_black;
  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <Pill active={tab === "white"} onClick={() => setTab("white")}>As White</Pill>
        <Pill active={tab === "black"} onClick={() => setTab("black")}>As Black</Pill>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 52px 44px 44px 44px", gap: "0.5rem 0.5rem" }}>
        {["Opening", "Games", "W", "D", "L"].map((h, i) => (
          <span key={h} style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#4D6A82", textAlign: i > 0 ? "center" : "left", paddingBottom: "0.25rem", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>{h}</span>
        ))}
        {entries.map((o, i) => <OpeningRow key={i} o={o} />)}
      </div>
      {entries.length === 0 && (
        <p style={{ fontSize: "0.875rem", color: "#8FA3B8", textAlign: "center", padding: "1.5rem 0" }}>No data available.</p>
      )}
    </div>
  );
}

function OpeningRow({ o }: { o: OpeningEntry }) {
  const total = o.wins + o.draws + o.losses || 1;
  const winPct = Math.round((o.wins / total) * 100);
  return (
    <>
      <div style={{ minWidth: 0, paddingTop: "0.5rem" }}>
        <div style={{ fontSize: "0.8125rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#F5F0E8" }}>{o.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
          <span style={{ fontSize: "0.6875rem", color: "#4D6A82" }}>{o.eco}</span>
          <div style={{ flex: 1, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.08)", maxWidth: 80 }}>
            <div style={{ height: "100%", borderRadius: 99, width: `${winPct}%`, background: winPct >= 60 ? "#34d399" : winPct >= 40 ? "#fbbf24" : "#f87171" }} />
          </div>
          <span style={{ fontSize: "0.6875rem", color: "#4D6A82" }}>{winPct}%</span>
        </div>
      </div>
      <span style={{ fontSize: "0.8125rem", color: "#8FA3B8", textAlign: "center", paddingTop: "0.5rem" }}>{o.games}</span>
      <span style={{ fontSize: "0.8125rem", color: "#34d399", textAlign: "center", fontWeight: 600, paddingTop: "0.5rem" }}>{o.wins}</span>
      <span style={{ fontSize: "0.8125rem", color: "#8FA3B8", textAlign: "center", paddingTop: "0.5rem" }}>{o.draws}</span>
      <span style={{ fontSize: "0.8125rem", color: "#f87171", textAlign: "center", paddingTop: "0.5rem" }}>{o.losses}</span>
    </>
  );
}

function TacticalList({ patterns }: { patterns: TacticalPattern[] }) {
  const freqStyle: Record<string, { color: string; bg: string; border: string }> = {
    common:     { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)" },
    occasional: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)"  },
    rare:       { color: "#8FA3B8", bg: "rgba(143,163,184,0.1)", border: "rgba(143,163,184,0.2)" },
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      {patterns.map((p, i) => {
        const fs = freqStyle[p.frequency] ?? freqStyle.rare;
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#F5F0E8" }}>{p.pattern}</span>
              <span style={{
                fontSize: "0.6875rem", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: 99,
                color: fs.color, background: fs.bg, border: `1px solid ${fs.border}`, textTransform: "capitalize",
              }}>{p.frequency}</span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "#8FA3B8", margin: 0, lineHeight: 1.55 }}>{p.description}</p>
          </div>
        );
      })}
    </div>
  );
}

function RecommendationCards({ recs }: { recs: OpeningRecommendation[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: "0.875rem" }}>
      {recs.map((r, i) => (
        <div key={i} style={{
          borderRadius: 12, padding: "1.125rem",
          display: "flex", flexDirection: "column", gap: "0.625rem",
          background: "#1A2E45",
          border: "1px solid rgba(255,255,255,0.08)",
          borderTop: `3px solid ${r.gap_type === "repertoire_gap" ? "#2563EB" : "#34d399"}`,
          transition: "box-shadow 0.15s, transform 0.15s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.4)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#F5F0E8", letterSpacing: "-0.01em" }}>{r.name}</div>
              <div style={{ fontSize: "0.75rem", color: "#4D6A82", marginTop: "0.1rem" }}>{r.eco}</div>
            </div>
            <span style={{
              flexShrink: 0, fontSize: "0.6875rem", fontWeight: 700, padding: "0.2rem 0.5rem",
              borderRadius: 99, textTransform: "capitalize", whiteSpace: "nowrap",
              color: r.gap_type === "repertoire_gap" ? "#D4A843" : "#34d399",
              background: r.gap_type === "repertoire_gap" ? "rgba(212,168,67,0.12)" : "rgba(52,211,153,0.1)",
              border: `1px solid ${r.gap_type === "repertoire_gap" ? "rgba(212,168,67,0.25)" : "rgba(52,211,153,0.25)"}`,
            }}>
              {r.gap_type === "repertoire_gap" ? "Repertoire gap" : "Style match"}
            </span>
          </div>
          <div style={{
            fontFamily: "monospace", fontSize: "0.8125rem",
            background: "linear-gradient(135deg, #1E3A5F, #112236)",
            padding: "0.5rem 0.75rem", borderRadius: 7,
            color: "#D4A843", lineHeight: 1.5,
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            {r.sample_moves}
          </div>
          <p style={{ fontSize: "0.8125rem", color: "#8FA3B8", margin: 0, lineHeight: 1.55 }}>{r.reason}</p>
        </div>
      ))}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, total, onPage }: {
  page: number; totalPages: number; total: number; onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const start = page * 25 + 1;
  const end   = Math.min((page + 1) * 25, total);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1rem", padding: "0 0.25rem" }}>
      <span style={{ fontSize: "0.8125rem", color: "#8FA3B8" }}>
        {start}–{end} of {total} games
      </span>
      <div style={{ display: "flex", gap: "0.375rem" }}>
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          style={{
            fontSize: "0.8125rem", fontFamily: "'Cabinet Grotesk', sans-serif",
            padding: "0.3rem 0.75rem", borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.09)", background: "#112236",
            color: page === 0 ? "#4D6A82" : "#2563EB",
            cursor: page === 0 ? "default" : "pointer",
          }}
        >
          ← Prev
        </button>
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            onClick={() => onPage(i)}
            style={{
              fontSize: "0.8125rem", fontFamily: "'Cabinet Grotesk', sans-serif",
              padding: "0.3rem 0.625rem", borderRadius: 6, minWidth: 32,
              border: i === page ? "1.5px solid #2563EB" : "1px solid rgba(255,255,255,0.09)",
              background: i === page ? "#1A2E45" : "#112236",
              color: i === page ? "#F5F0E8" : "#8FA3B8",
              cursor: "pointer", fontWeight: i === page ? 700 : 400,
            }}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages - 1}
          style={{
            fontSize: "0.8125rem", fontFamily: "'Cabinet Grotesk', sans-serif",
            padding: "0.3rem 0.75rem", borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.09)", background: "#112236",
            color: page === totalPages - 1 ? "#4D6A82" : "#2563EB",
            cursor: page === totalPages - 1 ? "default" : "pointer",
          }}
        >
          Next →
        </button>
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
      <div style={{
        display: "flex", flexDirection: "column", borderRadius: 12, overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
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
                  <svg width="13" height="13" viewBox="0 0 15 15" fill="none"><path d="M5 1h5M1 3.5h13M12 3.5l-.8 8.5a1 1 0 01-1 .9H4.8a1 1 0 01-1-.9L3 3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { games, batchAnalysis, isLoading, fetchGames, fetchBatchAnalysis, deleteGame, clearAllGames, triggerAnalysis, triggerBatchAnalysis, refreshGameInList } = useGameStore();
  const handleAnalyze = useCallback(async (id: string) => {
    await triggerAnalysis(id);
    refreshGameInList(id);
  }, [triggerAnalysis, refreshGameInList]);
  const { platform, result, gameType, dateKey, clearFilters } = useFilterStore();
  const [clearing, setClearing] = useState(false);
  const [page, setPage] = useState(0);
  const batchPollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const gamePollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingIdsRef  = useRef<string[]>([]);

  const PAGE_SIZE = 25;

  useEffect(() => {
    fetchGames();
    fetchBatchAnalysis();
  }, []);

  useEffect(() => {
    const active = batchAnalysis?.status === "pending" || batchAnalysis?.status === "running";
    if (active && !batchPollRef.current) {
      batchPollRef.current = setInterval(() => fetchBatchAnalysis(), 3000);
    } else if (!active && batchPollRef.current) {
      clearInterval(batchPollRef.current);
      batchPollRef.current = null;
    }
    return () => { if (batchPollRef.current) { clearInterval(batchPollRef.current); batchPollRef.current = null; } };
  }, [batchAnalysis?.status]);

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

  const hasFilters   = platform !== "all" || result !== "all" || gameType !== "all" || dateKey !== "all";
  const batchDone    = batchAnalysis?.status === "done" && !!batchAnalysis?.portfolio_data;
  const batchRunning = batchAnalysis?.status === "pending" || batchAnalysis?.status === "running";

  async function handleAnalyzePortfolio() {
    try { await triggerBatchAnalysis(); } catch { /* 409 = already running */ }
  }

  async function handleClearAll() {
    if (!window.confirm("Clear all imported games? This cannot be undone.")) return;
    setClearing(true);
    try { await clearAllGames(); clearFilters(); } finally { setClearing(false); }
  }

  const portfolio = batchAnalysis?.portfolio_data;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "1.5rem 2rem 5rem", background: "#0D1B2A" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <h1 style={{
            fontSize: "1.875rem", fontWeight: 800, letterSpacing: "-0.03em",
            marginBottom: "0.25rem",
            background: "linear-gradient(135deg, #F5F0E8 0%, #D4A843 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            {batchDone && portfolio ? `${portfolio.player_name}'s Chess Profile` : "My Games"}
          </h1>
          {!isLoading && games.length > 0 && (
            <p style={{ fontSize: "0.875rem", color: "#8FA3B8", fontWeight: 500 }}>
              {games.length} game{games.length !== 1 ? "s" : ""} imported
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.625rem" }}>
          {games.length > 0 && (
            <button onClick={handleClearAll} disabled={clearing} className="btn-danger" style={{ fontSize: "0.875rem", padding: "0.5625rem 1rem" }}>
              {clearing ? "Clearing…" : "Clear games"}
            </button>
          )}
          <Link to="/import" style={{ textDecoration: "none" }}>
            <button style={{ fontSize: "0.875rem", padding: "0.5625rem 1.125rem", whiteSpace: "nowrap" }}>+ Import games</button>
          </Link>
        </div>
      </div>

      {/* State 1: Empty */}
      {!isLoading && games.length === 0 && (
        <div style={{
          borderRadius: 20, overflow: "hidden",
          background: "linear-gradient(135deg, #0D1B2A 0%, #1E3A5F 50%, #2563EB 100%)",
          padding: "5rem 3rem", textAlign: "center",
          position: "relative",
        }}>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "radial-gradient(circle at 15% 85%, rgba(255,255,255,0.05) 0%, transparent 55%), radial-gradient(circle at 85% 15%, rgba(255,255,255,0.05) 0%, transparent 55%)",
          }} />
          <div style={{
            width: 72, height: 72, borderRadius: 18,
            background: "rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2rem", margin: "0 auto 1.5rem", backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}>♟</div>
          <h2 style={{
            fontSize: "2.25rem", fontWeight: 800, color: "#fff",
            marginBottom: "0.875rem", letterSpacing: "-0.035em", lineHeight: 1.15,
          }}>
            Understand your chess
          </h2>
          <p style={{
            fontSize: "1.0625rem", color: "rgba(255,255,255,0.7)",
            maxWidth: 460, margin: "0 auto 2.25rem", lineHeight: 1.65,
          }}>
            Import games from Chess.com. Get AI-powered opening analysis, tactical patterns, and personalised coaching recommendations.
          </p>
          <Link to="/import" style={{ textDecoration: "none" }}>
            <button style={{
              background: "#D4A843", color: "#0D1B2A",
              fontSize: "1rem", fontWeight: 700,
              padding: "0.75rem 2.25rem", borderRadius: 10,
              border: "none",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#C49B35"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#D4A843"; }}
            >
              Import your games
            </button>
          </Link>
          <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.35)", marginTop: "1.25rem" }}>
            Works with Chess.com accounts
          </p>
        </div>
      )}

      {/* State 2: Games imported, no portfolio yet */}
      {!isLoading && games.length > 0 && !batchDone && (
        <>
          {games.length < 100 && (
            <div style={{
              background: "rgba(212,168,67,0.08)", border: "1px solid rgba(212,168,67,0.2)", borderRadius: 10,
              padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "#D4A843", marginBottom: "1.5rem",
              display: "flex", alignItems: "center", gap: "0.5rem",
            }}>
              <span style={{ fontSize: "1rem" }}>⚠</span>
              You have {games.length} games — AI analysis works best with 100+ games.
            </div>
          )}

          {/* Stats strip */}
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
            <StatCard value={filtered.length} label="Games"  color="#2563EB" bg="rgba(37,99,235,0.1)"   />
            <StatCard value={wins}            label="Wins"   color="#34d399" bg="rgba(52,211,153,0.1)"  />
            <StatCard value={losses}          label="Losses" color="#f87171" bg="rgba(248,113,113,0.1)" />
            <StatCard value={draws}           label="Draws"  color="#8FA3B8" bg="rgba(143,163,184,0.1)" />
          </div>

          <FiltersBar />

          {/* Portfolio CTA */}
          {batchRunning ? (
            <div style={{
              borderRadius: 14, background: "#112236",
              border: "1px solid rgba(37,99,235,0.25)", padding: "1.625rem 1.75rem", marginBottom: "1.5rem",
              display: "flex", alignItems: "center", gap: "1rem",
            }}>
              <div style={{
                width: 40, height: 40, flexShrink: 0, borderRadius: 10,
                background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span className="spin" style={{ display: "block", color: "#fff" }}>
                  <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25"/>
                    <path d="M10 2a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </span>
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#F5F0E8", marginBottom: "0.2rem" }}>
                  Analysing your games…
                </p>
                <p style={{ fontSize: "0.8125rem", color: "#8FA3B8", margin: 0 }}>
                  Usually 15–30 seconds. This page updates automatically.
                </p>
              </div>
            </div>
          ) : (
            <div style={{
              borderRadius: 16, overflow: "hidden", marginBottom: "1.5rem",
              background: "linear-gradient(135deg, #0F2137 0%, #1D4ED8 60%, #2563EB 100%)",
              padding: "1.875rem 2rem",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2rem",
              position: "relative",
            }}>
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
                backgroundImage: "radial-gradient(circle at 90% 50%, rgba(255,255,255,0.06) 0%, transparent 60%)",
              }} />
              <div style={{ zIndex: 1 }}>
                <p style={{ fontWeight: 800, fontSize: "1.1875rem", color: "#fff", marginBottom: "0.4rem", letterSpacing: "-0.02em" }}>
                  Get your chess profile
                </p>
                <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.75)", margin: 0, maxWidth: 480, lineHeight: 1.55 }}>
                  AI analyses all {games.length} games to reveal your opening repertoire, playing style, tactical miss patterns, and personalised recommendations.
                </p>
              </div>
              <button
                onClick={handleAnalyzePortfolio}
                style={{
                  background: "#D4A843", color: "#0D1B2A", fontWeight: 700,
                  whiteSpace: "nowrap", padding: "0.75rem 1.75rem",
                  fontSize: "0.9375rem", flexShrink: 0, borderRadius: 10,
                  border: "none", zIndex: 1,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#C49B35"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#D4A843"; }}
              >
                Analyse my games
              </button>
            </div>
          )}

          {batchAnalysis?.status === "failed" && (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10,
              padding: "0.875rem 1.125rem", fontSize: "0.8125rem", color: "#f87171",
              marginBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>⚠</span>
                <span>Portfolio analysis failed — {cleanApiError(batchAnalysis.error)}</span>
              </div>
              <button onClick={handleAnalyzePortfolio} style={{ fontSize: "0.8125rem", padding: "0.3rem 0.75rem", marginLeft: "1rem" }}>Retry</button>
            </div>
          )}

          {filtered.length === 0 && hasFilters ? (
            <div style={{
              textAlign: "center", padding: "3rem 2rem",
              border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, background: "#112236",
            }}>
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

      {/* State 3: Portfolio done */}
      {!isLoading && games.length > 0 && batchDone && portfolio && (
        <>
          {/* Portfolio hero strip */}
          <div style={{
            borderRadius: 16, overflow: "hidden", marginBottom: "1.75rem",
            background: "linear-gradient(135deg, #0A1628 0%, #1E3A5F 55%, #2563EB 100%)",
            padding: "2rem 2.25rem",
            display: "grid", gridTemplateColumns: "1fr auto",
            gap: "2rem", alignItems: "center",
            position: "relative",
          }}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
              backgroundImage: "radial-gradient(circle at 85% 50%, rgba(255,255,255,0.07) 0%, transparent 55%), radial-gradient(circle at 5% 90%, rgba(255,255,255,0.04) 0%, transparent 40%)",
            }} />
            <div style={{ zIndex: 1 }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                Chess Profile
              </div>
              <h2 style={{ fontSize: "1.625rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: "0.5rem" }}>
                {portfolio.player_name}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <span style={{
                  display: "inline-block", padding: "0.3rem 0.875rem", borderRadius: 99,
                  fontSize: "0.8125rem", fontWeight: 700,
                  background: "rgba(212,168,67,0.18)", color: "#D4A843",
                  border: "1px solid rgba(212,168,67,0.3)", textTransform: "capitalize",
                }}>
                  {portfolio.playing_style.classification}
                </span>
                <span style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.55)" }}>
                  {portfolio.style_evolution.trend}
                </span>
              </div>
            </div>
            <div style={{ zIndex: 1, display: "flex", gap: "1.25rem", flexShrink: 0 }}>
              {[
                { v: games.length, l: "Games" },
                { v: filtered.filter(g => g.result === "1-0").length, l: "Wins" },
                { v: Math.round(filtered.filter(g => g.result === "1-0").length / (filtered.length || 1) * 100) + "%", l: "Win rate" },
              ].map(({ v, l }) => (
                <div key={l} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>{v}</div>
                  <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: "0.25rem" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <FiltersBar />

          {/* Style + Evolution */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: 0 }}>
            <SectionCard title="Playing Style" accentColor="#2563EB">
              <StyleCard style={portfolio.playing_style} />
            </SectionCard>
            <SectionCard title="Style Evolution" accentColor="#D4A843">
              <p style={{ fontSize: "0.875rem", color: "#8FA3B8", lineHeight: 1.65, margin: 0 }}>
                {portfolio.style_evolution.description}
              </p>
            </SectionCard>
          </div>

          {/* Pawn structures + Tactical patterns */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: 0 }}>
            <SectionCard title="Pawn Structure Tendencies" accentColor="#34d399">
              <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {portfolio.pawn_structures.map((s, i) => (
                  <li key={i} style={{ fontSize: "0.875rem", color: "#8FA3B8", lineHeight: 1.55 }}>{s}</li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard title="Tactical Miss Patterns" accentColor="#f87171">
              <TacticalList patterns={portfolio.tactical_patterns} />
            </SectionCard>
          </div>

          {/* Opening repertoire */}
          <SectionCard title="Opening Repertoire" accentColor="#fbbf24">
            <OpeningTable repertoire={portfolio.opening_repertoire} />
          </SectionCard>

          {/* Recommendations */}
          <SectionCard
            title="Opening Recommendations"
            accentColor="#2563EB"
            action={
              <button onClick={handleAnalyzePortfolio} className="btn-ghost" style={{ fontSize: "0.8125rem", padding: "0.3rem 0.75rem" }}>
                Re-analyse
              </button>
            }
          >
            <RecommendationCards recs={portfolio.opening_recommendations} />
          </SectionCard>

          {/* Game Library */}
          <div style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
              <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, letterSpacing: "-0.01em", color: "#F5F0E8" }}>Game Library</h2>
              {filtered.length > 0 && (
                <span style={{ fontSize: "0.8125rem", color: "#8FA3B8" }}>{filtered.length} game{filtered.length !== 1 ? "s" : ""}</span>
              )}
            </div>
            {filtered.length === 0 && hasFilters ? (
              <div style={{
                textAlign: "center", padding: "2.5rem",
                border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, background: "#112236",
              }}>
                <p style={{ fontWeight: 600, marginBottom: "0.4rem", color: "#F5F0E8" }}>No games match these filters</p>
                <button className="btn-ghost" onClick={clearFilters} style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>Clear filters</button>
              </div>
            ) : (
              <>
                <GameTable games={paginated} onDelete={deleteGame} onAnalyze={handleAnalyze} />
                <Pagination page={page} totalPages={totalPages} total={filtered.length} onPage={setPage} />
              </>
            )}
          </div>
        </>
      )}

      {isLoading && (
        <div style={{ padding: "5rem 0", textAlign: "center", color: "#8FA3B8", fontSize: "0.9rem" }}>
          <Spinner /> &nbsp; Loading your games…
        </div>
      )}
    </div>
  );
}
