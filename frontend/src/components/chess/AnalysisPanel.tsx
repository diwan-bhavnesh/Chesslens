import { Chess } from "chess.js";
import type { GameAnalysis, MoveEntry, MoveClassification } from "../../types";

const SYMBOL: Record<MoveClassification, string> = {
  brilliant:  "!!",
  best:       "",
  good:       "",
  inaccuracy: "?!",
  mistake:    "?",
  blunder:    "??",
};

const CLASS_LABEL: Record<MoveClassification, string> = {
  brilliant:  "Brilliant",
  best:       "Best move",
  good:       "Good",
  inaccuracy: "Inaccuracy",
  mistake:    "Mistake",
  blunder:    "Blunder",
};

const CLASS_COLOR: Record<MoveClassification, string> = {
  brilliant:  "#1bada6",
  best:       "#5c8a3e",
  good:       "#5c8a3e",
  inaccuracy: "#d4a017",
  mistake:    "#e07c1c",
  blunder:    "#c41e3a",
};

type AnalysisState = "none" | "running" | "done" | "failed";

interface Props {
  analysis: GameAnalysis | null;
  analysisState: AnalysisState;
  currentEntry: MoveEntry | null;
  hasDeepAnalysis: boolean;
  autoAnalyzing: boolean;
  prevFen: string;
  onTriggerAnalysis: () => void;
}

function uciToSan(fen: string, uci: string): string | null {
  try {
    const ch = new Chess(fen);
    const result = ch.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
    return result?.san ?? null;
  } catch {
    return null;
  }
}

export function AnalysisPanel({ analysis, analysisState, currentEntry, hasDeepAnalysis, autoAnalyzing, prevFen, onTriggerAnalysis }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* Current move card */}
      {currentEntry ? (
        <CurrentMoveCard entry={currentEntry} prevFen={prevFen} />
      ) : (
        <p style={{ fontSize: "0.8125rem", color: "#8FA3B8", margin: 0 }}>
          Select a move to see details.
        </p>
      )}

      {/* Trigger / status */}
      {analysisState === "none" && (
        <button
          onClick={onTriggerAnalysis}
          style={{
            padding: "0.6875rem 1rem",
            background: "#2563EB",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontFamily: "'Cabinet Grotesk', sans-serif",
            fontSize: "0.875rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Run Analysis
        </button>
      )}

      {analysisState === "running" && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.625rem",
          fontSize: "0.8125rem", color: "#8FA3B8",
        }}>
          <Spinner />
          Analyzing with Stockfish…
        </div>
      )}

      {analysisState === "failed" && (
        <div style={{
          background: "#1A2E45",
          borderRadius: 8,
          borderLeft: "3px solid #ef4444",
          padding: "0.75rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}>
          <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f87171", margin: 0 }}>
            Analysis failed
          </p>
          <p style={{ fontSize: "0.8125rem", color: "#8FA3B8", margin: 0 }}>
            Stockfish may not be installed or the PGN is invalid.
          </p>
          <button
            onClick={onTriggerAnalysis}
            className="btn-outline"
            style={{ fontSize: "0.8125rem", padding: "0.375rem 0.875rem", alignSelf: "flex-start" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Analysis results */}
      {analysisState === "done" && analysis && (
        <>
          {/* Subtle badge while depth-15 auto-analyzes in background */}
          {autoAnalyzing && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.75rem",
              color: "#8FA3B8",
              padding: "0.375rem 0",
            }}>
              <MiniSpinner />
              Running move-by-move analysis…
            </div>
          )}

          <Section label="Accuracy">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              <AccuracyRow label="White" value={analysis.accuracy_white} color="#F5F0E8" />
              <AccuracyRow label="Black" value={analysis.accuracy_black} color="#2563EB" />
            </div>
          </Section>

          <Divider />

          <Section label="Move Quality">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
              <StatRow label="Brilliant"  icon="!!" color="#1bada6" white={analysis.brilliants_white ?? 0} black={analysis.brilliants_black ?? 0} />
              <StatRow label="Blunder"    icon="??" color="#c41e3a" white={analysis.blunders_white}        black={analysis.blunders_black} />
              <StatRow label="Mistake"    icon="?"  color="#e07c1c" white={analysis.mistakes_white}        black={analysis.mistakes_black} />
              <StatRow label="Inaccuracy" icon="?!" color="#d4a017" white={analysis.inaccuracies_white}   black={analysis.inaccuracies_black} />
            </div>
          </Section>

          {analysis.claude_summary && (
            <>
              <Divider />
              <Section label="AI Review">
                <p style={{
                  margin: 0,
                  fontSize: "0.8125rem",
                  color: "#8FA3B8",
                  lineHeight: 1.75,
                  whiteSpace: "pre-wrap",
                }}>
                  {analysis.claude_summary}
                </p>
              </Section>
            </>
          )}

          {hasDeepAnalysis && (
            <button
              onClick={onTriggerAnalysis}
              className="btn-ghost"
              style={{ fontSize: "0.75rem", padding: "0.3rem 0.75rem", alignSelf: "flex-start", marginTop: "0.25rem" }}
            >
              Re-analyze
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Sub-components

function CurrentMoveCard({ entry, prevFen }: { entry: MoveEntry; prevFen: string }) {
  const cls    = entry.classification;
  const symbol = cls ? SYMBOL[cls] : "";
  const color  = cls ? CLASS_COLOR[cls] : "#8FA3B8";
  const label  = cls ? CLASS_LABEL[cls] : null;

  const evalVal = entry.eval_after;
  const evalStr = evalVal == null ? null
    : Math.abs(evalVal) >= 90
      ? `M${Math.ceil((999 - Math.abs(evalVal)) / 10)}`
      : (evalVal > 0 ? "+" : "") + evalVal.toFixed(2);

  const bestSan = entry.best_move ? uciToSan(prevFen, entry.best_move) : null;

  const evalDrop =
    entry.eval_before != null && entry.eval_after != null
      ? entry.color === "white"
        ? entry.eval_before - entry.eval_after
        : entry.eval_after - entry.eval_before
      : null;

  const verbalText = buildVerbalText(cls, evalDrop, bestSan);

  return (
    <div style={{
      background: "#1A2E45",
      borderRadius: 10,
      overflow: "hidden",
      border: `1px solid ${color}44`,
    }}>
      {/* Colored header strip */}
      <div style={{
        background: `linear-gradient(135deg, ${color}22 0%, ${color}0a 100%)`,
        borderBottom: `1px solid ${color}33`,
        padding: "0.75rem 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.5rem",
      }}>
        <span style={{ fontWeight: 800, fontSize: "1.25rem", color: "#F5F0E8", letterSpacing: "-0.02em" }}>
          {entry.moveNumber}.{entry.color === "black" ? ".." : ""}{" "}
          {entry.san}
          {symbol && (
            <span style={{ color, fontWeight: 900, marginLeft: "4px", fontSize: "1.125rem" }}>{symbol}</span>
          )}
        </span>
        {label && (
          <span style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color,
            background: `${color}25`,
            padding: "4px 12px",
            borderRadius: 99,
            whiteSpace: "nowrap",
            border: `1px solid ${color}44`,
          }}>
            {label}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {(evalStr != null || (entry.best_move && cls && !["best", "brilliant"].includes(cls))) && (
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {evalStr != null && (
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#8FA3B8" }}>Eval</span>
                <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#F5F0E8" }}>{evalStr}</span>
              </div>
            )}
            {entry.best_move && cls && !["best", "brilliant"].includes(cls) && (
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#8FA3B8" }}>Best</span>
                <span style={{ fontSize: "1rem", fontWeight: 700, color: "#F5F0E8", fontFamily: "monospace" }}>
                  {bestSan ?? entry.best_move}
                </span>
              </div>
            )}
          </div>
        )}

        {verbalText && (
          <p style={{
            margin: 0,
            fontSize: "0.875rem",
            color: "#8FA3B8",
            lineHeight: 1.6,
          }}>
            {verbalText}
          </p>
        )}
      </div>
    </div>
  );
}

function buildVerbalText(
  cls: MoveClassification | null,
  evalDrop: number | null,
  bestSan: string | null,
): string | null {
  if (!cls) return null;
  const drop = evalDrop != null && evalDrop > 0 ? evalDrop.toFixed(1) : null;
  const best = bestSan ? ` Best was ${bestSan}.` : "";
  switch (cls) {
    case "brilliant":  return "Brilliant move!";
    case "best":       return "Best move in the position.";
    case "good":       return "Good move.";
    case "inaccuracy": return `Slight inaccuracy.${best}`;
    case "mistake":    return drop ? `Mistake — dropped ${drop} pawns.${best}` : `Mistake.${best}`;
    case "blunder":    return drop ? `Blunder — dropped ${drop} pawns.${best}` : `Blunder.${best}`;
  }
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#8FA3B8", letterSpacing: "0.02em" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />;
}

function AccuracyRow({ label, value, color }: { label: string; value: number | null; color: string }) {
  const pct = value ?? 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
      <span style={{ width: 36, fontSize: "0.75rem", fontWeight: 600, color: "#8FA3B8", flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 99,
          transition: "width 0.6s ease",
        }} />
      </div>
      <span style={{ width: 42, fontSize: "0.875rem", fontWeight: 700, color: "#F5F0E8", textAlign: "right", flexShrink: 0 }}>
        {value != null ? `${value.toFixed(1)}%` : "—"}
      </span>
    </div>
  );
}

function StatRow({ label, icon, color, white, black }: {
  label: string; icon: string; color: string; white: number; black: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0" }}>
      <span style={{
        width: 20, height: 20, borderRadius: 4,
        background: `${color}22`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <span style={{ color, fontSize: "0.625rem", fontWeight: 800, lineHeight: 1 }}>{icon}</span>
      </span>
      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#F5F0E8", flex: 1 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
        <span style={{ fontSize: "0.6875rem", fontWeight: 500, color: "#8FA3B8" }}>W</span>
        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: white > 0 ? color : "#4D6A82", minWidth: 14, textAlign: "right" }}>{white}</span>
        <span style={{ fontSize: "0.75rem", color: "#4D6A82", margin: "0 2px" }}>·</span>
        <span style={{ fontSize: "0.6875rem", fontWeight: 500, color: "#8FA3B8" }}>B</span>
        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: black > 0 ? color : "#4D6A82", minWidth: 14, textAlign: "right" }}>{black}</span>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 14, height: 14,
      border: "2px solid rgba(37,99,235,0.2)",
      borderTopColor: "#2563EB",
      borderRadius: "50%",
      flexShrink: 0,
      animation: "spin 0.75s linear infinite",
    }} />
  );
}

function MiniSpinner() {
  return (
    <div style={{
      width: 10, height: 10,
      border: "1.5px solid rgba(143,163,184,0.25)",
      borderTopColor: "#8FA3B8",
      borderRadius: "50%",
      flexShrink: 0,
      animation: "spin 0.75s linear infinite",
    }} />
  );
}
