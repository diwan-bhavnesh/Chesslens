import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useGameStore } from "../store/gameStore";
import { useProfileStore } from "../store/profileStore";
import { useAuthStore } from "../store/authStore";
import type { OpeningStat2, OpponentOpening, CoachingRecommendation, PlayerProfile } from "../types";

// ── Chess quotes ──────────────────────────────────────────────────────────────

const CHESS_QUOTES = [
  { quote: "Chess is life in miniature. Chess is a struggle, chess is battles.", author: "Garry Kasparov" },
  { quote: "Every chess master was once a beginner.", author: "Irving Chernev" },
  { quote: "Chess is the art of analysis.", author: "Mikhail Botvinnik" },
  { quote: "In chess, as in life, opportunity strikes but once.", author: "Victor Korchnoi" },
  { quote: "Chess is not about the next move, but the next plan.", author: "Savielly Tartakower" },
  { quote: "The pawns are the soul of chess.", author: "François-André Danican Philidor" },
  { quote: "When you see a good move, look for a better one.", author: "Emanuel Lasker" },
  { quote: "Chess is a war over the board. The object is to crush the opponent's mind.", author: "Bobby Fischer" },
  { quote: "The hardest game to win is a won game.", author: "Emanuel Lasker" },
  { quote: "Chess is beautiful enough to waste your life for.", author: "Hans Ree" },
  { quote: "I am convinced that chess is a superb educational tool for training young minds.", author: "Garry Kasparov" },
  { quote: "No one ever won a game by resigning.", author: "Savielly Tartakower" },
];

function AccuracyPlaceholder() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * CHESS_QUOTES.length));

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % CHESS_QUOTES.length), 8000);
    return () => clearInterval(t);
  }, []);

  const q = CHESS_QUOTES[idx];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.875rem",
      padding: "1rem 0",
    }}>
      <span className="spin" style={{ display: "block", color: "#4D6A82", flexShrink: 0 }}>
        <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25"/>
          <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </span>
      <div style={{ minWidth: 0 }}>
        <span style={{ fontSize: "0.8125rem", color: "#4D6A82" }}>Computing… </span>
        <span style={{ fontSize: "0.8125rem", color: "#4D6A82", fontStyle: "italic" }}>
          "{q.quote}" — {q.author}
        </span>
      </div>
    </div>
  );
}

function Layer2Banner({ profile }: { profile: PlayerProfile }) {
  const pct = profile.games_total && profile.games_done != null
    ? Math.round((profile.games_done / profile.games_total) * 100)
    : null;

  return (
    <div style={{
      borderRadius: 8, padding: "0.625rem 1rem", marginBottom: "1.25rem",
      background: "#112236", border: "1px solid rgba(37,99,235,0.25)",
      display: "flex", alignItems: "center", gap: "0.75rem",
    }}>
      <span className="spin" style={{ display: "block", color: "#2563EB", flexShrink: 0 }}>
        <svg viewBox="0 0 16 16" fill="none" width="15" height="15">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25"/>
          <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </span>
      <span style={{ fontSize: "0.8125rem", color: "#8FA3B8", flex: 1 }}>
        Accuracy analysis running in the background
        {pct != null ? ` — ${pct}%` : ""}
        {" "}— <span style={{ color: "#F5F0E8" }}>no need to stay.</span>
      </span>
    </div>
  );
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

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

function SectionCard({ title, subtitle, children, accentColor, style }: {
  title: string; subtitle?: string; children: React.ReactNode; accentColor?: string; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.08)",
      borderTop: `2.5px solid ${accentColor ?? "#2563EB"}`,
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: "1rem",
      background: "#132840",
      boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
      ...style,
    }}>
      <div style={{
        padding: "0.875rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "#1A2E45",
      }}>
        <span style={{ fontWeight: 700, fontSize: "1rem", color: "#F5F0E8", letterSpacing: "-0.01em" }}>{title}</span>
        {subtitle && (
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "#4D6A82", lineHeight: 1.4 }}>{subtitle}</p>
        )}
      </div>
      <div style={{ padding: "1.125rem 1.25rem" }}>{children}</div>
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

// ── Style badge ───────────────────────────────────────────────────────────────

const STYLE_MAP: Record<string, { color: string; bg: string }> = {
  aggressive: { color: "#f87171", bg: "rgba(248,113,113,0.15)" },
  defensive:  { color: "#60a5fa", bg: "rgba(96,165,250,0.15)"  },
  positional: { color: "#34d399", bg: "rgba(52,211,153,0.15)"  },
  tactical:   { color: "#fbbf24", bg: "rgba(251,191,36,0.15)"  },
};

function StyleBadge({ classification }: { classification: string }) {
  const s = STYLE_MAP[classification] ?? { color: "#D4A843", bg: "rgba(212,168,67,0.15)" };
  return (
    <span style={{
      display: "inline-block", padding: "0.3rem 0.875rem", borderRadius: 99,
      fontSize: "0.8125rem", fontWeight: 700, textTransform: "capitalize",
      color: s.color, background: s.bg,
      border: `1px solid ${s.color}33`,
    }}>
      {classification}
    </span>
  );
}

// ── Opening table ─────────────────────────────────────────────────────────────

function OpeningTable2({ white, black, opponents }: {
  white: OpeningStat2[];
  black: OpeningStat2[];
  opponents: OpponentOpening[];
}) {
  const [tab, setTab] = useState<"white" | "black" | "opponents">("white");

  const isOpp = tab === "opponents";
  const entries: Array<{ name: string; count: number; wins: number; draws: number; losses: number }> =
    isOpp
      ? opponents.map(o => ({ name: o.name, count: o.times_faced, wins: o.wins, draws: o.draws, losses: o.losses }))
      : (tab === "white" ? white : black).map(o => ({ name: o.name, count: o.games, wins: o.wins, draws: o.draws, losses: o.losses }));

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <Pill active={tab === "white"} onClick={() => setTab("white")}>As White</Pill>
        <Pill active={tab === "black"} onClick={() => setTab("black")}>As Black</Pill>
        <Pill active={tab === "opponents"} onClick={() => setTab("opponents")}>Opponents</Pill>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 44px 44px 44px", gap: "0.5rem" }}>
        {["Opening", isOpp ? "Faced" : "Games", "W", "D", "L"].map((h, i) => (
          <span key={h} style={{
            fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.07em", color: "#4D6A82",
            textAlign: i > 0 ? "center" : "left",
            paddingBottom: "0.25rem", borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}>{h}</span>
        ))}
        {entries.map((o, i) => {
          const total = o.wins + o.draws + o.losses || 1;
          const winPct = Math.round((o.wins / total) * 100);
          return (
            <div key={i} style={{ display: "contents" }}>
              <div style={{ paddingTop: "0.5rem", minWidth: 0 }}>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#F5F0E8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.15rem" }}>
                  <div style={{ flex: 1, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.08)", maxWidth: 72 }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${winPct}%`, background: winPct >= 60 ? "#34d399" : winPct >= 40 ? "#fbbf24" : "#f87171" }} />
                  </div>
                  <span style={{ fontSize: "0.6875rem", color: "#4D6A82" }}>{winPct}%</span>
                </div>
              </div>
              <span style={{ fontSize: "0.8125rem", color: "#8FA3B8", textAlign: "center", paddingTop: "0.5rem" }}>{o.count}</span>
              <span style={{ fontSize: "0.8125rem", color: "#34d399", textAlign: "center", fontWeight: 600, paddingTop: "0.5rem" }}>{o.wins}</span>
              <span style={{ fontSize: "0.8125rem", color: "#8FA3B8", textAlign: "center", paddingTop: "0.5rem" }}>{o.draws}</span>
              <span style={{ fontSize: "0.8125rem", color: "#f87171", textAlign: "center", paddingTop: "0.5rem" }}>{o.losses}</span>
            </div>
          );
        })}
        {entries.length === 0 && (
          <p style={{ gridColumn: "1/-1", fontSize: "0.875rem", color: "#8FA3B8", textAlign: "center", padding: "1.5rem 0" }}>No data available.</p>
        )}
      </div>
    </div>
  );
}

// ── Coaching recommendations ──────────────────────────────────────────────────

function CoachingList({ recs }: { recs: CoachingRecommendation[] }) {
  const priorityColor = { high: "#f87171", medium: "#fbbf24", low: "#34d399" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {recs.map((r, i) => (
        <div key={i} style={{
          padding: "0.875rem 1rem", borderRadius: 8,
          background: "#1A2E45", border: "1px solid rgba(255,255,255,0.07)",
          borderLeft: `3px solid ${priorityColor[r.priority] ?? "#2563EB"}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
            <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#F5F0E8" }}>{r.title}</span>
            <span style={{
              fontSize: "0.6875rem", fontWeight: 700, padding: "0.15rem 0.45rem",
              borderRadius: 99, textTransform: "capitalize",
              color: priorityColor[r.priority] ?? "#8FA3B8",
              background: `${priorityColor[r.priority] ?? "#8FA3B8"}18`,
            }}>{r.priority}</span>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "#8FA3B8", lineHeight: 1.55, margin: 0 }}>{r.detail}</p>
        </div>
      ))}
    </div>
  );
}

// ── Phase accuracy bars ───────────────────────────────────────────────────────

function PhaseBar({ label, value, color }: { label: string; value: number | null; color: string }) {
  const pct = value ?? 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
      <span style={{ width: 90, fontSize: "0.875rem", color: "#8FA3B8", flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 99, background: "rgba(255,255,255,0.07)" }}>
        <div style={{ height: "100%", borderRadius: 99, width: `${pct}%`, background: color, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ width: 38, fontSize: "0.875rem", fontWeight: 700, color: "#F5F0E8", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {value != null ? `${value}%` : "—"}
      </span>
    </div>
  );
}

// ── Rating chart ──────────────────────────────────────────────────────────────

const TC_LABEL: Record<string, string> = {
  "60": "Bullet", "60+0": "Bullet", "120": "Bullet", "120+1": "Bullet",
  "180": "Blitz", "180+0": "Blitz", "180+2": "Blitz",
  "300": "Blitz", "300+0": "Blitz", "300+3": "Blitz", "300+5": "Blitz",
  "600": "Blitz", "600+0": "Blitz",
  "900": "Rapid", "900+0": "Rapid", "900+10": "Rapid",
  "1800": "Rapid", "3600": "Classical",
};

function tcLabel(tc: string | null): string {
  if (!tc) return "Other";
  return TC_LABEL[tc] ?? (parseInt(tc) <= 179 ? "Bullet" : parseInt(tc) <= 599 ? "Blitz" : parseInt(tc) <= 1799 ? "Rapid" : "Classical");
}

function tcReadable(tc: string): string {
  const [base, inc = "0"] = tc.split("+");
  const secs = parseInt(base);
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  const baseStr = rem > 0 ? `${mins}m${rem}s` : `${mins}`;
  return parseInt(inc) > 0 ? `${baseStr}+${inc}` : `${baseStr}+0`;
}

const RatingChart = memo(function RatingChart({ profile }: { profile: PlayerProfile }) {
  const history = profile.rating_history;
  if (!history || history.length === 0) {
    return <p style={{ fontSize: "0.875rem", color: "#8FA3B8", textAlign: "center", padding: "2rem 0" }}>No rating history available.</p>;
  }

  // Build game-type → raw-TC → count index
  const typeIndex: Record<string, Record<string, number>> = {};
  for (const p of history) {
    const rawTc = (p as any).time_control ?? "";
    const type = tcLabel(rawTc || null);
    if (!typeIndex[type]) typeIndex[type] = {};
    typeIndex[type][rawTc] = (typeIndex[type][rawTc] ?? 0) + 1;
  }

  // Game type options sorted by frequency
  const typeCounts: Record<string, number> = {};
  for (const [type, tcs] of Object.entries(typeIndex)) {
    typeCounts[type] = Object.values(tcs).reduce((a, b) => a + b, 0);
  }
  const typeOptions = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const defaultType = typeOptions[0] ?? "All";

  const [selectedType, setSelectedType] = useState<string>(defaultType);
  const [selectedRawTc, setSelectedRawTc] = useState<string>("All");

  // TC options for the selected game type, sorted by frequency
  const rawTcCounts = selectedType === "All"
    ? Object.values(typeIndex).reduce((acc, tcs) => { for (const [k, v] of Object.entries(tcs)) acc[k] = (acc[k] ?? 0) + v; return acc; }, {} as Record<string, number>)
    : (typeIndex[selectedType] ?? {});
  const rawTcOptions = Object.entries(rawTcCounts).sort((a, b) => b[1] - a[1]).map(([k]) => k);

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setSelectedRawTc("All");
  };

  // Filter history
  const filtered = history.filter(p => {
    const rawTc = (p as any).time_control ?? "";
    if (selectedType !== "All" && tcLabel(rawTc || null) !== selectedType) return false;
    if (selectedRawTc !== "All" && rawTc !== selectedRawTc) return false;
    return true;
  });

  const points = filtered
    .filter(p => p.elo > 0)
    .map(p => ({ date: p.date.slice(0, 7), elo: p.elo }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const ddStyle: React.CSSProperties = {
    background: "#1A2E45", color: "#F5F0E8", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 6, padding: "0.3rem 0.5rem", fontSize: "0.8125rem",
    fontFamily: "'Cabinet Grotesk', sans-serif", cursor: "pointer", outline: "none",
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "0.625rem", marginBottom: "1rem", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4D6A82" }}>Game Type</span>
          <select value={selectedType} onChange={e => handleTypeChange(e.target.value)} style={ddStyle}>
            {typeOptions.length > 1 && <option value="All">All</option>}
            {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4D6A82" }}>Time Control</span>
          <select value={selectedRawTc} onChange={e => setSelectedRawTc(e.target.value)} style={ddStyle}>
            {rawTcOptions.length > 1 && <option value="All">All</option>}
            {rawTcOptions.map(tc => (
              <option key={tc} value={tc}>{tcReadable(tc)}</option>
            ))}
          </select>
        </div>
      </div>
      {points.length === 0
        ? <p style={{ fontSize: "0.875rem", color: "#8FA3B8", textAlign: "center", padding: "2rem 0" }}>No data for selected filters.</p>
        : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={points} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={false} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#4D6A82", fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "#1A2E45", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#F5F0E8" }}
                labelStyle={{ color: "#8FA3B8", fontSize: 12 }}
              />
              <Line type="monotone" dataKey="elo" stroke="#D4A843" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
    </div>
  );
}, (prev, next) => {
  const ph = prev.profile.rating_history;
  const nh = next.profile.rating_history;
  if (ph === nh) return true;
  if (!ph || !nh) return ph === nh;
  return ph.length === nh.length;
});

// ── Accuracy chart ────────────────────────────────────────────────────────────

const ROLLING_WINDOW = 15;

function rollingAvg(vals: (number | null)[], w: number): (number | null)[] {
  return vals.map((_, i) => {
    const slice = vals.slice(Math.max(0, i - w + 1), i + 1).filter(v => v != null) as number[];
    return slice.length > 0 ? Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10 : null;
  });
}

function AccuracyChart({ profile }: { profile: PlayerProfile }) {
  const history = profile.accuracy_history;
  const [filter, setFilter] = useState<"all" | "white" | "black">("all");

  if (!history || history.length === 0) return <AccuracyPlaceholder />;

  // Guard: stale profile stored old format — user needs to rebuild
  if ((history[0] as any).accuracy === undefined) {
    return (
      <p style={{ fontSize: "0.875rem", color: "#8FA3B8", padding: "0.5rem 0" }}>
        Rebuild your profile to see the updated accuracy chart.
      </p>
    );
  }

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const filtered = filter === "all" ? sorted : sorted.filter(p => p.color === filter);

  if (filtered.length === 0) {
    return (
      <div>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <Pill active={filter === "all"} onClick={() => setFilter("all")}>All Games</Pill>
          <Pill active={filter === "white"} onClick={() => setFilter("white")}>As White</Pill>
          <Pill active={filter === "black"} onClick={() => setFilter("black")}>As Black</Pill>
        </div>
        <p style={{ fontSize: "0.875rem", color: "#8FA3B8", padding: "1rem 0" }}>No data for this colour.</p>
      </div>
    );
  }

  const smoothed = rollingAvg(filtered.map(p => p.accuracy), ROLLING_WINDOW);
  const points = filtered.map((p, i) => ({ date: p.date.slice(0, 7), acc: smoothed[i] }));
  const lineColor = filter === "white" ? "#F5F0E8" : filter === "black" ? "#60a5fa" : "#D4A843";

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <Pill active={filter === "all"} onClick={() => setFilter("all")}>All Games</Pill>
        <Pill active={filter === "white"} onClick={() => setFilter("white")}>As White</Pill>
        <Pill active={filter === "black"} onClick={() => setFilter("black")}>As Black</Pill>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={points} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="date" tick={false} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: "#4D6A82", fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "#1A2E45", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#F5F0E8" }}
            formatter={(v) => (v != null ? [`${v}%`, `${ROLLING_WINDOW}-game avg`] : ["", ""])}
          />
          <Line type="monotone" dataKey="acc" stroke={lineColor} strokeWidth={2} dot={false} name="Accuracy" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Dashboard states ──────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{
      borderRadius: 20, overflow: "hidden",
      background: "linear-gradient(135deg, #0D1B2A 0%, #1E3A5F 50%, #2563EB 100%)",
      padding: "5rem 3rem", textAlign: "center", position: "relative",
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
      <h2 style={{ fontSize: "2.25rem", fontWeight: 800, color: "#fff", marginBottom: "0.875rem", letterSpacing: "-0.035em", lineHeight: 1.15 }}>
        Build your Chess Profile
      </h2>
      <p style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.7)", maxWidth: 460, margin: "0 auto 2.25rem", lineHeight: 1.65 }}>
        Import your games from Chess.com. We recommend 100+ games for the most accurate profile.
      </p>
      <Link to="/import" style={{ textDecoration: "none" }}>
        <button style={{
          background: "#D4A843", color: "#0D1B2A", fontSize: "1rem", fontWeight: 700,
          padding: "0.75rem 2.25rem", borderRadius: 10, border: "none",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#C49B35"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#D4A843"; }}
        >
          Import games
        </button>
      </Link>
    </div>
  );
}

function GamesNoProfileState({ gameCount, onBuild, isBuilding }: { gameCount: number; onBuild: () => void; isBuilding: boolean }) {
  return (
    <div style={{
      borderRadius: 16, overflow: "hidden", marginBottom: "1.5rem",
      background: "linear-gradient(135deg, #0F2137 0%, #1D4ED8 60%, #2563EB 100%)",
      padding: "2rem 2.25rem",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2rem",
      position: "relative",
    }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle at 90% 50%, rgba(255,255,255,0.06) 0%, transparent 60%)",
      }} />
      <div style={{ zIndex: 1 }}>
        <p style={{ fontWeight: 800, fontSize: "1.1875rem", color: "#fff", marginBottom: "0.4rem", letterSpacing: "-0.02em" }}>
          {gameCount} game{gameCount !== 1 ? "s" : ""} imported — ready to build your profile
        </p>
        <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.75)", margin: 0, maxWidth: 480, lineHeight: 1.55 }}>
          One click starts the analysis. Your profile appears instantly; accuracy data fills in within a minute.
        </p>
      </div>
      <button
        onClick={onBuild}
        disabled={isBuilding}
        style={{
          background: "#D4A843", color: "#0D1B2A", fontWeight: 700,
          whiteSpace: "nowrap", padding: "0.75rem 1.75rem",
          fontSize: "0.9375rem", flexShrink: 0, borderRadius: 10,
          border: "none", zIndex: 1, cursor: isBuilding ? "not-allowed" : "pointer",
          opacity: isBuilding ? 0.7 : 1,
        }}
        onMouseEnter={e => { if (!isBuilding) (e.currentTarget as HTMLButtonElement).style.background = "#C49B35"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#D4A843"; }}
      >
        {isBuilding ? "Building…" : "Build My Profile"}
      </button>
    </div>
  );
}

function PipelineRunningState({ profile }: { profile: PlayerProfile }) {
  const pct = profile.games_total && profile.games_done != null
    ? Math.round((profile.games_done / profile.games_total) * 100)
    : null;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "5rem 2rem", textAlign: "center",
    }}>
      <span className="spin" style={{ display: "block", color: "#2563EB", marginBottom: "1.5rem" }}>
        <svg viewBox="0 0 40 40" fill="none" width="48" height="48">
          <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2"/>
          <path d="M20 4a16 16 0 0 1 16 16" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        </svg>
      </span>
      <h2 style={{ fontSize: "1.625rem", fontWeight: 800, color: "#F5F0E8", marginBottom: "0.625rem", letterSpacing: "-0.025em" }}>
        Building your profile…
      </h2>
      {profile.progress && (
        <p style={{ fontSize: "0.9375rem", color: "#8FA3B8", marginBottom: "1.5rem" }}>{profile.progress}</p>
      )}
      {pct != null && (
        <div style={{ width: "100%", maxWidth: 360, marginBottom: "1.25rem" }}>
          <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.08)" }}>
            <div style={{ height: "100%", borderRadius: 99, width: `${pct}%`, background: "#2563EB", transition: "width 0.5s ease" }} />
          </div>
          <p style={{ fontSize: "0.8125rem", color: "#4D6A82", marginTop: "0.5rem" }}>
            {profile.games_done} / {profile.games_total} games
          </p>
        </div>
      )}
      <p style={{ fontSize: "0.875rem", color: "#4D6A82" }}>This page updates automatically.</p>
    </div>
  );
}

// ── Full profile view ─────────────────────────────────────────────────────────

function ProfileView({ profile, gameCount }: { profile: PlayerProfile; gameCount: number; onRebuild: () => void }) {
  const cp = profile.claude_profile;
  const hasAccuracyHistory = (profile.accuracy_history?.length ?? 0) > 0;
  const hasPhaseAccuracy = profile.phase_accuracy != null && profile.phase_accuracy.opening != null;
  const hasTimePressure = profile.time_pressure != null && profile.time_pressure.normal_accuracy != null;
  const hasOpenings = (profile.openings_white?.length ?? 0) > 0 || (profile.openings_black?.length ?? 0) > 0 || (profile.opponent_openings?.length ?? 0) > 0;
  const showTwoColumns = hasOpenings && (hasPhaseAccuracy || hasTimePressure);
  const style = cp?.playing_style;

  const totalW = profile.total_wins ?? 0;
  const totalD = profile.total_draws ?? 0;
  const totalL = profile.total_losses ?? 0;
  const hasWdl = totalW + totalD + totalL > 0;
  const wdlTotal = totalW + totalD + totalL || 1;
  const wPct = (totalW / wdlTotal) * 100;
  const dPct = (totalD / wdlTotal) * 100;
  const lPct = (totalL / wdlTotal) * 100;

  return (
    <>
      {/* Stats strip */}
      <div style={{
        borderRadius: 16, overflow: "hidden", marginBottom: "1.25rem",
        background: "linear-gradient(135deg, #0A1628 0%, #1E3A5F 55%, #2563EB 100%)",
        padding: "1.25rem 1.75rem",
        display: "flex", alignItems: "center", gap: "2.5rem", flexWrap: "wrap",
        position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle at 85% 50%, rgba(255,255,255,0.07) 0%, transparent 55%)",
        }} />

        {/* Game count + playing style badge */}
        <div style={{ zIndex: 1 }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>
            Chess Profile
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.025em" }}>
            {gameCount} game{gameCount !== 1 ? "s" : ""} analysed
          </div>
          {style && (
            <div style={{ marginTop: "0.4rem" }}>
              <StyleBadge classification={style.classification} />
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.12)", flexShrink: 0, zIndex: 1 }} />

        {/* Win % per colour */}
        {[
          { v: profile.win_pct_white != null ? `${Math.round(profile.win_pct_white)}%` : "—", l: "Win % White" },
          { v: profile.win_pct_black != null ? `${Math.round(profile.win_pct_black)}%` : "—", l: "Win % Black" },
        ].map(({ v, l }) => (
          <div key={l} style={{ zIndex: 1 }}>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: "0.625rem", fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: "0.2rem" }}>{l}</div>
          </div>
        ))}

        {/* W/D/L stacked bar */}
        {hasWdl && (
          <>
            <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.12)", flexShrink: 0, zIndex: 1 }} />
            <div style={{ flex: 1, minWidth: 160, maxWidth: 280, zIndex: 1 }}>
              <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                Overall Record
              </div>
              <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", gap: 2, marginBottom: "0.5rem" }}>
                <div style={{ width: `${wPct}%`, background: "#34d399", borderRadius: "99px 0 0 99px" }} />
                <div style={{ width: `${dPct}%`, background: "rgba(255,255,255,0.3)" }} />
                <div style={{ width: `${lPct}%`, background: "#f87171", borderRadius: "0 99px 99px 0" }} />
              </div>
              <div style={{ display: "flex", gap: "1.25rem" }}>
                {[
                  { count: totalW, label: "W", color: "#34d399", dot: "#34d399" },
                  { count: totalD, label: "D", color: "rgba(255,255,255,0.6)", dot: "rgba(255,255,255,0.35)" },
                  { count: totalL, label: "L", color: "#f87171", dot: "#f87171" },
                ].map(({ count, label, color, dot }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <div style={{ width: 7, height: 7, borderRadius: 99, background: dot, flexShrink: 0 }} />
                    <span style={{ fontSize: "0.8125rem", fontWeight: 700, color }}>{count}</span>
                    <span style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.35)" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Rating history — full width */}
      <SectionCard title="Rating History" accentColor="#D4A843">
        <RatingChart profile={profile} />
      </SectionCard>

      {/* Two-column row: Opening Repertoire | Phase Accuracy + Time Pressure */}
      {showTwoColumns ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem", alignItems: "stretch" }}>
          <SectionCard title="Opening Repertoire" accentColor="#fbbf24" style={{ marginBottom: 0 }}>
            <OpeningTable2
              white={profile.openings_white ?? []}
              black={profile.openings_black ?? []}
              opponents={profile.opponent_openings ?? []}
            />
          </SectionCard>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {hasPhaseAccuracy && (
              <SectionCard title="Phase Accuracy" accentColor="#f87171" style={{ marginBottom: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <PhaseBar label="Opening" value={profile.phase_accuracy!.opening} color="#60a5fa" />
                  <PhaseBar label="Middlegame" value={profile.phase_accuracy!.middlegame} color="#fbbf24" />
                  <PhaseBar label="Endgame" value={profile.phase_accuracy!.endgame} color="#34d399" />
                </div>
              </SectionCard>
            )}
            {hasTimePressure && (
              <SectionCard title="Time Pressure" accentColor="#fbbf24" style={{ marginBottom: 0, flex: 1 }}>
                <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                  {[
                    { label: "Normal", value: profile.time_pressure!.normal_accuracy, color: "#34d399" },
                    { label: "Under Pressure", value: profile.time_pressure!.pressure_accuracy, color: "#f87171" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#4D6A82" }}>{label}</span>
                      <span style={{ fontSize: "2rem", fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.03em" }}>
                        {value != null ? `${value}%` : "—"}
                      </span>
                      <span style={{ fontSize: "0.8125rem", color: "#8FA3B8" }}>accuracy</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        </div>
      ) : (
        <>
          {hasOpenings && (
            <SectionCard title="Opening Repertoire" accentColor="#fbbf24">
              <OpeningTable2
                white={profile.openings_white ?? []}
                black={profile.openings_black ?? []}
                opponents={profile.opponent_openings ?? []}
              />
            </SectionCard>
          )}
        </>
      )}

      {/* Analysis unavailable — hidden until Claude credits restored */}

      {/* Playing style */}
      {style && (
        <SectionCard title="Playing Style" accentColor="#2563EB">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <StyleBadge classification={style.classification} />
            <p style={{ fontSize: "0.875rem", color: "#8FA3B8", lineHeight: 1.65, margin: 0 }}>{style.description}</p>
            {style.evidence && style.evidence.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {style.evidence.map((e, i) => (
                  <li key={i} style={{ fontSize: "0.8125rem", color: "#8FA3B8", lineHeight: 1.55 }}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        </SectionCard>
      )}

      {/* Coaching */}
      {cp && (cp.coaching_recommendations?.length ?? 0) > 0 && (
        <SectionCard title="Coaching Recommendations" accentColor="#34d399">
          <CoachingList recs={cp.coaching_recommendations} />
        </SectionCard>
      )}

      {/* Accuracy over time — full width, only when Layer 2 data is ready */}
      {hasAccuracyHistory && (
        <SectionCard
          title="Accuracy Over Time"
          accentColor="#a78bfa"
          subtitle="Based on depth-5 Stockfish analysis of tactical positions."
        >
          <AccuracyChart profile={profile} />
        </SectionCard>
      )}
    </>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { games, isLoading: gamesLoading, fetchGames, clearAllGames } = useGameStore();
  const { profile, isLoading: profileLoading, fetchProfile, pollProfile, createProfile, rebuildProfile, clearProfile } = useProfileStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const staleRebuildRef = useRef(false);

  useEffect(() => {
    fetchGames();
    fetchProfile();
  }, []);

  // If the profile is stuck in 'pending' with no active build (e.g. after a reset),
  // force-trigger a rebuild so the user isn't stuck watching a spinner forever.
  useEffect(() => {
    if (profile?.status === "pending" && !staleRebuildRef.current) {
      staleRebuildRef.current = true;
      rebuildProfile().catch(() => {});
    }
  }, [profile?.status]);

  const isPipelineActive = profile?.status === "pending" || profile?.status === "running";
  const hasGames = games.length > 0;
  const profileDone = profile?.status === "done";

  // layer2Running: Layer 1 done but accuracy data not yet populated
  const layer2Running = hasGames && profileDone && profile!.games_total != null && !(
    (profile!.accuracy_history?.length ?? 0) > 0 &&
    profile!.phase_accuracy?.opening != null &&
    profile!.time_pressure?.normal_accuracy != null
  );

  const shouldPoll = isPipelineActive || layer2Running;

  useEffect(() => {
    if (shouldPoll && !pollRef.current) {
      pollRef.current = setInterval(() => pollProfile(), 3000);
    } else if (!shouldPoll && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [shouldPoll]);

  const handleBuild = useCallback(async () => {
    setIsBuilding(true);
    try {
      await createProfile();
      await fetchProfile();
    } catch {
      // best-effort
    } finally {
      setIsBuilding(false);
    }
  }, [createProfile, fetchProfile]);

  const handleDeleteAll = useCallback(async () => {
    setIsDeleting(true);
    try {
      await clearAllGames();
      clearProfile();
      navigate("/");
    } catch {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  }, [clearAllGames, clearProfile, navigate]);

  const isLoading = gamesLoading || profileLoading;
  const displayGameCount = profile?.total_games ?? games.length;
  const hasProfile = profile !== null;
  const profileFailed = profile?.status === "failed";

  // Detect stale accuracy format (old: accuracy_white/accuracy_black, new: accuracy + color)
  const accuracyIsStaleFormat = profileDone && (
    (profile!.accuracy_history?.length ?? 0) > 0 &&
    (profile!.accuracy_history![0] as any).accuracy === undefined
  );

  const showUpdateButton = profileDone && (
    profile!.game_count_at_last_build == null ||
    games.length > profile!.game_count_at_last_build ||
    accuracyIsStaleFormat
  );

  if (isLoading) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 2rem 5rem", background: "#0D1B2A" }}>
        <div style={{ padding: "5rem 0", textAlign: "center", color: "#8FA3B8", fontSize: "0.9rem" }}>
          <Spinner /> &nbsp; Loading…
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 2rem 5rem", background: "#0D1B2A" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <h1 style={{
            fontSize: "1.875rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "0.25rem",
            background: "linear-gradient(135deg, #F5F0E8 0%, #D4A843 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            {user?.email ? `${user.email.split("@")[0]}'s Profile` : "Chess Profile"}
          </h1>
          {hasGames && (
            <p style={{ fontSize: "0.875rem", color: "#8FA3B8" }}>
              {displayGameCount} game{displayGameCount !== 1 ? "s" : ""} imported
              {profile?.updated_at && (
                <span style={{ color: "#4D6A82" }}>
                  {" · Updated "}
                  {(() => {
                    const diff = Date.now() - new Date(profile.updated_at).getTime();
                    const mins = Math.floor(diff / 60000);
                    const hrs = Math.floor(mins / 60);
                    const days = Math.floor(hrs / 24);
                    if (mins < 1) return "just now";
                    if (mins < 60) return `${mins}m ago`;
                    if (hrs < 24) return `${hrs}h ago`;
                    return `${days}d ago`;
                  })()}
                </span>
              )}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
          {showUpdateButton && (
            <button
              onClick={handleBuild}
              disabled={isBuilding}
              style={{
                background: "#2563EB", color: "#fff", fontWeight: 700,
                padding: "0.5625rem 1.125rem", fontSize: "0.875rem",
                borderRadius: 8, border: "none", cursor: "pointer",
              }}
            >
              {isBuilding ? "Updating…" : "Update Profile"}
            </button>
          )}
          {(hasGames || hasProfile) && (
            <button
              onClick={() => setShowDeleteModal(true)}
              style={{
                background: "transparent", color: "#4D6A82", fontWeight: 600,
                padding: "0.5625rem 1rem", fontSize: "0.8125rem",
                borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.4)"; (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = "#4D6A82"; }}
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#132840", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
            padding: "2rem", maxWidth: 400, width: "90%",
            boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
          }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#F5F0E8", marginBottom: "0.75rem" }}>Delete all data?</h3>
            <p style={{ fontSize: "0.875rem", color: "#8FA3B8", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              This will permanently delete all {displayGameCount} imported game{displayGameCount !== 1 ? "s" : ""} and your profile. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                style={{
                  background: "transparent", color: "#8FA3B8", fontWeight: 600,
                  padding: "0.5rem 1.25rem", fontSize: "0.875rem",
                  borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={isDeleting}
                style={{
                  background: "#ef4444", color: "#fff", fontWeight: 700,
                  padding: "0.5rem 1.25rem", fontSize: "0.875rem",
                  borderRadius: 8, border: "none", cursor: isDeleting ? "not-allowed" : "pointer",
                  opacity: isDeleting ? 0.7 : 1,
                }}
              >
                {isDeleting ? "Deleting…" : "Delete Everything"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* State: no games — always wins; nothing else renders */}
      {!hasGames && <EmptyState />}

      {/* State: games exist, no profile */}
      {hasGames && !hasProfile && !isPipelineActive && (
        <GamesNoProfileState gameCount={games.length} onBuild={handleBuild} isBuilding={isBuilding} />
      )}

      {/* State: pipeline running */}
      {hasGames && hasProfile && isPipelineActive && (
        <PipelineRunningState profile={profile} />
      )}

      {/* State: failed */}
      {hasGames && hasProfile && profileFailed && (
        <div style={{
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12,
          padding: "1.5rem", textAlign: "center",
        }}>
          <p style={{ color: "#f87171", fontWeight: 700, marginBottom: "0.75rem" }}>Profile analysis failed</p>
          {profile.error && <p style={{ fontSize: "0.875rem", color: "#8FA3B8", marginBottom: "1rem" }}>{profile.error}</p>}
          <button onClick={handleBuild} style={{ padding: "0.5rem 1.5rem" }}>Retry</button>
        </div>
      )}

      {/* State: profile done */}
      {hasGames && hasProfile && profileDone && (
        <>
          {layer2Running && <Layer2Banner profile={profile} />}
          <ProfileView profile={profile} gameCount={displayGameCount} onRebuild={handleBuild} />
        </>
      )}
    </div>
  );
}
