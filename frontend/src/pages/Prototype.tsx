import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ── Mock data ─────────────────────────────────────────────────────────────────

const RATING_POINTS = [
  { date: "2025-11", elo: 1365 }, { date: "2025-11", elo: 1340 }, { date: "2025-12", elo: 1310 },
  { date: "2025-12", elo: 1380 }, { date: "2026-01", elo: 1430 }, { date: "2026-01", elo: 1460 },
  { date: "2026-02", elo: 1510 }, { date: "2026-02", elo: 1560 }, { date: "2026-03", elo: 1540 },
  { date: "2026-03", elo: 1575 }, { date: "2026-04", elo: 1555 }, { date: "2026-05", elo: 1590 },
];

const ACCURACY_POINTS = [
  { date: "2025-11", acc: 88 }, { date: "2025-12", acc: 85 }, { date: "2026-01", acc: 87 },
  { date: "2026-01", acc: 89 }, { date: "2026-02", acc: 86 }, { date: "2026-02", acc: 91 },
  { date: "2026-03", acc: 88 }, { date: "2026-03", acc: 90 }, { date: "2026-04", acc: 92 },
  { date: "2026-05", acc: 91 },
];

const OPENINGS_WHITE = [
  { name: "Scandinavian Defense", games: 9, wins: 4, draws: 0, losses: 5 },
  { name: "Caro-Kann Defense Main Line", games: 9, wins: 4, draws: 0, losses: 5 },
  { name: "Alekhine Defense Scandinavian", games: 8, wins: 5, draws: 0, losses: 3 },
  { name: "Italian Game", games: 6, wins: 4, draws: 0, losses: 2 },
  { name: "French Defense", games: 5, wins: 3, draws: 1, losses: 1 },
];

const OPENINGS_BLACK = [
  { name: "King's Pawn Opening", games: 12, wins: 6, draws: 2, losses: 4 },
  { name: "Sicilian Defense", games: 10, wins: 5, draws: 1, losses: 4 },
  { name: "Queen's Gambit Declined", games: 7, wins: 3, draws: 2, losses: 2 },
  { name: "Ruy Lopez", games: 6, wins: 2, draws: 1, losses: 3 },
  { name: "English Opening", games: 4, wins: 2, draws: 0, losses: 2 },
];

// ── Shared primitives ─────────────────────────────────────────────────────────

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      fontSize: "0.8125rem", fontWeight: active ? 600 : 500,
      fontFamily: "'Cabinet Grotesk', sans-serif",
      padding: "0.3rem 0.7rem", borderRadius: "99px",
      border: active ? "1.5px solid #2563EB" : "1px solid rgba(255,255,255,0.09)",
      background: active ? "#1A2E45" : "transparent",
      color: active ? "#F5F0E8" : "#8FA3B8",
      cursor: "pointer", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function SectionCard({ title, accentColor, children, style }: {
  title: string; accentColor?: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.08)",
      borderTop: `2.5px solid ${accentColor ?? "#2563EB"}`,
      borderRadius: 12, overflow: "hidden",
      background: "#132840", boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
      ...style,
    }}>
      <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#1A2E45" }}>
        <span style={{ fontWeight: 700, fontSize: "1rem", color: "#F5F0E8" }}>{title}</span>
      </div>
      <div style={{ padding: "1.125rem 1.25rem" }}>{children}</div>
    </div>
  );
}

// ── Rating chart ──────────────────────────────────────────────────────────────

function RatingChart() {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={RATING_POINTS} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="date" tick={{ fill: "#4D6A82", fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: "#4D6A82", fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
        <Tooltip contentStyle={{ background: "#1A2E45", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#F5F0E8" }} />
        <Line type="monotone" dataKey="elo" stroke="#D4A843" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Accuracy chart (rolling avg, single line with toggle) ─────────────────────

function AccuracyChart() {
  const [color, setColor] = useState<"white" | "black">("white");
  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <Pill active={color === "white"} onClick={() => setColor("white")}>As White</Pill>
        <Pill active={color === "black"} onClick={() => setColor("black")}>As Black</Pill>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={ACCURACY_POINTS} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="date" tick={{ fill: "#4D6A82", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: "#4D6A82", fontSize: 11 }} tickLine={false} axisLine={false} domain={[70, 100]} />
          <Tooltip contentStyle={{ background: "#1A2E45", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#F5F0E8" }} />
          <Line
            type="monotone" dataKey="acc"
            stroke={color === "white" ? "#F5F0E8" : "#60a5fa"}
            strokeWidth={2} dot={false}
            name="Accuracy %"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Opening table ─────────────────────────────────────────────────────────────

function OpeningTable() {
  const [tab, setTab] = useState<"white" | "black" | "opponents">("white");
  const entries = tab === "white" ? OPENINGS_WHITE : OPENINGS_BLACK;

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <Pill active={tab === "white"} onClick={() => setTab("white")}>As White</Pill>
        <Pill active={tab === "black"} onClick={() => setTab("black")}>As Black</Pill>
        <Pill active={tab === "opponents"} onClick={() => setTab("opponents")}>Opponents</Pill>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 52px 36px 36px 36px", gap: "0.5rem" }}>
        {["Opening", "Games", "W", "D", "L"].map((h, i) => (
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
          const barColor = winPct >= 55 ? "#34d399" : winPct >= 40 ? "#fbbf24" : "#f87171";
          return (
            <div key={i} style={{ display: "contents" }}>
              <div style={{ paddingTop: "0.5rem", minWidth: 0 }}>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#F5F0E8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.15rem" }}>
                  <div style={{ width: 48, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.08)", flexShrink: 0 }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${winPct}%`, background: barColor }} />
                  </div>
                  <span style={{ fontSize: "0.6875rem", color: "#4D6A82" }}>{winPct}%</span>
                </div>
              </div>
              <span style={{ paddingTop: "0.5rem", textAlign: "center", fontSize: "0.8125rem", color: "#8FA3B8" }}>{o.games}</span>
              <span style={{ paddingTop: "0.5rem", textAlign: "center", fontSize: "0.8125rem", color: "#34d399", fontWeight: 600 }}>{o.wins}</span>
              <span style={{ paddingTop: "0.5rem", textAlign: "center", fontSize: "0.8125rem", color: "#8FA3B8" }}>{o.draws}</span>
              <span style={{ paddingTop: "0.5rem", textAlign: "center", fontSize: "0.8125rem", color: "#f87171", fontWeight: 600 }}>{o.losses}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Phase accuracy ────────────────────────────────────────────────────────────

function PhaseAccuracy() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      {[
        { label: "Opening", value: 93.4, color: "#60a5fa" },
        { label: "Middlegame", value: 90, color: "#fbbf24" },
        { label: "Endgame", value: 84.6, color: "#34d399" },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ width: 86, fontSize: "0.8125rem", color: "#8FA3B8", flexShrink: 0 }}>{label}</span>
          <div style={{ flex: 1, height: 7, borderRadius: 99, background: "rgba(255,255,255,0.07)" }}>
            <div style={{ height: "100%", borderRadius: 99, width: `${value}%`, background: color }} />
          </div>
          <span style={{ width: 40, fontSize: "0.875rem", fontWeight: 700, color: "#F5F0E8", textAlign: "right" }}>{value}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Time pressure ─────────────────────────────────────────────────────────────

function TimePressure() {
  return (
    <div style={{ display: "flex", gap: "2rem" }}>
      {[
        { label: "Normal", value: "89.6%", color: "#34d399" },
        { label: "Under Pressure", value: "84.2%", color: "#f87171" },
      ].map(({ label, value, color }) => (
        <div key={label}>
          <span style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#4D6A82", marginBottom: "0.25rem" }}>{label}</span>
          <span style={{ fontSize: "1.75rem", fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
          <span style={{ display: "block", fontSize: "0.75rem", color: "#8FA3B8", marginTop: "0.2rem" }}>accuracy</span>
        </div>
      ))}
    </div>
  );
}

// ── Prototype page ────────────────────────────────────────────────────────────

export function Prototype() {
  return (
    <div style={{ background: "#0D1B2A", minHeight: "calc(100vh - 56px)", padding: "1.5rem 2rem 5rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "0.5rem",
          background: "rgba(212,168,67,0.1)", color: "#D4A843",
          fontSize: "0.75rem", fontWeight: 600, padding: "0.25rem 0.75rem",
          borderRadius: 99, border: "1px solid rgba(212,168,67,0.2)", marginBottom: "1.25rem",
        }}>
          Prototype — not wired to backend
        </div>

        {/* Stats strip */}
        <div style={{
          borderRadius: 12, overflow: "hidden", marginBottom: "1.25rem",
          background: "linear-gradient(135deg, #0A1628 0%, #1E3A5F 55%, #2563EB 100%)",
          padding: "1.25rem 1.75rem",
          display: "flex", alignItems: "center", gap: "2.5rem", flexWrap: "wrap",
        }}>
          {/* Game count */}
          <div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>Chess Profile</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.025em" }}>537 games analysed</div>
          </div>

          <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.12)", flexShrink: 0 }} />

          {/* Win % */}
          {[{ v: "53%", l: "Win % White" }, { v: "51%", l: "Win % Black" }].map(({ v, l }) => (
            <div key={l}>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: "0.625rem", fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: "0.2rem" }}>{l}</div>
            </div>
          ))}

          <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.12)", flexShrink: 0 }} />

          {/* W/D/L stacked bar */}
          {(() => {
            const w = 291, d = 42, l = 204, total = 537;
            const wPct = (w / total) * 100;
            const dPct = (d / total) * 100;
            const lPct = (l / total) * 100;
            return (
              <div style={{ flex: 1, minWidth: 160, maxWidth: 280 }}>
                <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Overall Record</div>
                {/* Stacked bar */}
                <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", gap: 2, marginBottom: "0.5rem" }}>
                  <div style={{ width: `${wPct}%`, background: "#34d399", borderRadius: "99px 0 0 99px" }} />
                  <div style={{ width: `${dPct}%`, background: "rgba(255,255,255,0.3)" }} />
                  <div style={{ width: `${lPct}%`, background: "#f87171", borderRadius: "0 99px 99px 0" }} />
                </div>
                {/* Counts */}
                <div style={{ display: "flex", gap: "1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <div style={{ width: 7, height: 7, borderRadius: 99, background: "#34d399", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#34d399" }}>{w}</span>
                    <span style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.35)" }}>W</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <div style={{ width: 7, height: 7, borderRadius: 99, background: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>{d}</span>
                    <span style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.35)" }}>D</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <div style={{ width: 7, height: 7, borderRadius: 99, background: "#f87171", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#f87171" }}>{l}</span>
                    <span style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.35)" }}>L</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Row 1: Rating History (full width) */}
        <SectionCard title="Rating History" accentColor="#D4A843" style={{ marginBottom: "1rem" }}>
          <RatingChart />
        </SectionCard>

        {/* Row 2: Two columns — Opening Repertoire | Phase Accuracy + Time Pressure */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem", alignItems: "stretch" }}>
          <SectionCard title="Opening Repertoire" accentColor="#fbbf24">
            <OpeningTable />
          </SectionCard>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <SectionCard title="Phase Accuracy" accentColor="#f87171">
              <PhaseAccuracy />
            </SectionCard>
            <SectionCard title="Time Pressure" accentColor="#fbbf24" style={{ flex: 1 }}>
              <TimePressure />
            </SectionCard>
          </div>
        </div>

        {/* Row 3: Accuracy Over Time (full width) */}
        <SectionCard title="Accuracy Over Time" accentColor="#a78bfa">
          <AccuracyChart />
        </SectionCard>

      </div>
    </div>
  );
}
