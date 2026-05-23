import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Chess } from "chess.js";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { useChessGame } from "../hooks/useChessGame";
import type { GameAnalysis } from "../types";
import { ChessBoard } from "../components/chess/ChessBoard";
import { MoveList } from "../components/chess/MoveList";
import { AnalysisPanel } from "../components/chess/AnalysisPanel";
import { EvalBar } from "../components/chess/EvalBar";
import { EvalGraph } from "../components/chess/EvalGraph";

type AnalysisState = "none" | "running" | "done" | "failed";

const calcBoardSize = () => Math.max(300, Math.min(window.innerHeight - 220, 560));

export function GameReview() {
  const { id } = useParams<{ id: string }>();
  const { currentGame, fetchGame, triggerAnalysis } = useGameStore();
  const { user } = useAuthStore();
  const [localLoading, setLocalLoading] = useState(true);

  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const orientationSetRef = useRef(false);
  const [boardSize, setBoardSize] = useState(calcBoardSize);
  const [autoAnalyzing, setAutoAnalyzing] = useState(false);
  const [cachedAnalysis, setCachedAnalysis] = useState<GameAnalysis | null>(null);

  useEffect(() => {
    if (!id) return;
    orientationSetRef.current = false;
    setLocalLoading(true);
    fetchGame(id).finally(() => setLocalLoading(false));
  }, [id]);

  useEffect(() => {
    const handler = () => setBoardSize(calcBoardSize());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Auto-set orientation once per game: show the board from the user's side
  useEffect(() => {
    if (!currentGame || orientationSetRef.current) return;
    const username = user?.chesscom_username?.toLowerCase();
    if (username && currentGame.black_player?.toLowerCase() === username) {
      setOrientation("black");
    }
    orientationSetRef.current = true;
  }, [currentGame?.id]);

  const { entries, currentFen, currentEntry, currentMoveIndex, goToMove, goForward, goBack, goToStart, goToEnd } =
    useChessGame(currentGame?.pgn ?? "", currentGame?.moves ?? []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft")       { e.preventDefault(); goBack(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goForward(); }
      else if (e.key === "ArrowUp")    { e.preventDefault(); goToStart(); }
      else if (e.key === "ArrowDown")  { e.preventDefault(); goToEnd(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goBack, goForward, goToStart, goToEnd]);

  const analysisState: AnalysisState = !currentGame?.analysis
    ? "none"
    : currentGame.analysis.status === "done"   ? "done"
    : currentGame.analysis.status === "failed" ? "failed"
    : "running";

  useEffect(() => {
    if (analysisState !== "running" || !id) return;
    const t = setInterval(() => fetchGame(id), 3000);
    return () => clearInterval(t);
  }, [analysisState, id]);

  const hasDeepAnalysis = useMemo(
    () => (currentGame?.moves ?? []).some(m => m.best_move !== null),
    [currentGame?.moves],
  );

  // Auto-trigger depth-15 silently when only bulk data exists — fires once per game open
  useEffect(() => {
    if (analysisState !== "done" || hasDeepAnalysis || autoAnalyzing || !id || !currentGame?.analysis) return;
    setCachedAnalysis(currentGame.analysis);
    setAutoAnalyzing(true);
    triggerAnalysis(id)
      .then(() => fetchGame(id))  // refresh status so polling interval kicks in
      .catch(() => {
        setAutoAnalyzing(false);
        setCachedAnalysis(null);
      });
  }, [analysisState, hasDeepAnalysis, autoAnalyzing, id]);

  // Clear auto-analyzing state once depth-15 completes
  useEffect(() => {
    if (hasDeepAnalysis && autoAnalyzing) {
      setAutoAnalyzing(false);
      setCachedAnalysis(null);
    }
  }, [hasDeepAnalysis, autoAnalyzing]);

  const handleTriggerAnalysis = useCallback(async () => {
    if (!id) return;
    await triggerAnalysis(id);
    await fetchGame(id);
  }, [id, triggerAnalysis, fetchGame]);

  const startFen = useMemo(() => new Chess().fen(), []);
  const prevFen = currentMoveIndex > 0
    ? entries[currentMoveIndex - 1]?.fen ?? startFen
    : startFen;

  const lastMoveSquares = useMemo<[string, string] | null>(
    () => currentEntry
      ? [currentEntry.uci.slice(0, 2), currentEntry.uci.slice(2, 4)]
      : null,
    [currentEntry?.uci],
  );

  const bestMoveArrow = useMemo<[string, string] | null>(
    () =>
      currentEntry?.best_move &&
      currentEntry.classification &&
      !["best", "brilliant"].includes(currentEntry.classification)
        ? [currentEntry.best_move.slice(0, 2), currentEntry.best_move.slice(2, 4)]
        : null,
    [currentEntry?.best_move, currentEntry?.classification],
  );

  if (localLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 56px)", color: "#8FA3B8" }}>
        Loading game…
      </div>
    );
  }

  if (!currentGame) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 56px)", color: "#8FA3B8" }}>
        Game not found.{" "}
        <Link to="/dashboard" style={{ marginLeft: "0.5rem" }}>Back to dashboard</Link>
      </div>
    );
  }

  const boardColWidth = boardSize + 20;

  const topSide    = orientation === "white" ? "black" : "white";
  const bottomSide = orientation === "white" ? "white" : "black";

  return (
    <div style={{
      height: "calc(100vh - 56px)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      padding: "1.25rem 2rem 1rem",
      boxSizing: "border-box",
      background: "#0D1B2A",
    }}>

      {/* Header */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        marginBottom: "0.875rem",
      }}>
        <Link to="/dashboard" style={{
          display: "inline-flex", alignItems: "center", gap: "0.3rem",
          fontSize: "0.8125rem", color: "#8FA3B8", textDecoration: "none",
          fontWeight: 500,
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Dashboard
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          {currentGame.result && (
            <span style={{
              background: "rgba(212,168,67,0.12)",
              color: "#D4A843",
              padding: "2px 9px",
              borderRadius: 4,
              fontWeight: 700,
              fontSize: "0.75rem",
            }}>
              {currentGame.result === "1/2-1/2" ? "½–½" : currentGame.result}
            </span>
          )}
          {currentGame.opening && (
            <span style={{ fontSize: "0.75rem", color: "#8FA3B8" }}>{currentGame.opening}</span>
          )}
          {currentGame.time_control && (
            <span style={{ fontSize: "0.75rem", color: "#4D6A82" }}>{currentGame.time_control}</span>
          )}
        </div>
      </header>

      {/* Main 3-panel layout */}
      <div style={{
        display: "flex",
        flexDirection: "row",
        gap: "1.25rem",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}>

        {/* Panel 1: Board */}
        <div style={{ flexShrink: 0, width: boardColWidth, display: "flex", flexDirection: "column", gap: "0.375rem" }}>

          <div style={{ paddingLeft: 20 }}>
            <PlayerChip
              name={topSide === "white" ? currentGame.white_player : currentGame.black_player}
              elo={topSide === "white" ? currentGame.white_elo : currentGame.black_elo}
              side={topSide}
            />
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <EvalBar eval={currentEntry?.eval_after ?? null} height={boardSize} />
            <ChessBoard
              fen={currentFen}
              orientation={orientation}
              lastMoveSquares={lastMoveSquares}
              boardWidth={boardSize}
              bestMoveArrow={bestMoveArrow}
            />
          </div>

          <div style={{ paddingLeft: 20 }}>
            <PlayerChip
              name={bottomSide === "white" ? currentGame.white_player : currentGame.black_player}
              elo={bottomSide === "white" ? currentGame.white_elo : currentGame.black_elo}
              side={bottomSide}
            />
          </div>

          {/* Eval graph */}
          <div style={{ paddingLeft: 20, paddingRight: 0 }}>
            <EvalGraph
              entries={entries}
              currentMoveIndex={currentMoveIndex}
              onSelectMove={goToMove}
            />
          </div>

          {/* Nav controls */}
          <div style={{ paddingLeft: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem", paddingTop: "0.375rem" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              background: "#132840",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "4px 8px",
              gap: 2,
              width: "100%",
              justifyContent: "center",
            }}>
              <NavBtn onClick={goToStart} title="First move"><IconFirst /></NavBtn>
              <NavBtn onClick={goBack}    title="Previous move"><IconPrev /></NavBtn>

              <div style={{
                minWidth: 72, textAlign: "center", userSelect: "none",
                fontSize: "0.8125rem", fontWeight: 600, color: "#8FA3B8",
              }}>
                {currentMoveIndex < 0 ? "Start" : `${currentMoveIndex + 1} / ${entries.length}`}
              </div>

              <NavBtn onClick={goForward} title="Next move"><IconNext /></NavBtn>
              <NavBtn onClick={goToEnd}   title="Last move"><IconLast /></NavBtn>

              <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)", margin: "0 6px" }} />

              <NavBtn onClick={() => setOrientation(o => o === "white" ? "black" : "white")} title="Flip board">
                <IconFlip />
              </NavBtn>
            </div>
            <span style={{ fontSize: "0.6875rem", color: "#4D6A82", userSelect: "none" }}>
              ← → arrow keys to navigate
            </span>
          </div>
        </div>

        {/* Panel 2: Move list */}
        <div style={{
          width: 260,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          background: "#112236",
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.07)",
        }}>
          <div style={{
            flexShrink: 0,
            padding: "0.625rem 0.875rem 0.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "#1A2E45",
          }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#F5F0E8" }}>
              Moves
            </span>
            <span style={{ fontSize: "0.75rem", color: "#8FA3B8", fontWeight: 400 }}>
              {entries.length}
            </span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0.25rem 0.375rem 0.5rem" }}>
            <MoveList
              entries={entries}
              currentMoveIndex={currentMoveIndex}
              onSelectMove={goToMove}
            />
          </div>
        </div>

        {/* Panel 3: Analysis */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          background: "#112236",
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.07)",
        }}>
          <div style={{
            flexShrink: 0,
            padding: "0.625rem 1rem 0.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "#1A2E45",
          }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#F5F0E8" }}>
              Analysis
            </span>
            {analysisState === "done" && !autoAnalyzing && (
              <span style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "#2563EB",
                background: "rgba(37,99,235,0.12)",
                padding: "2px 8px",
                borderRadius: 99,
              }}>
                Complete
              </span>
            )}
            {autoAnalyzing && (
              <span style={{
                fontSize: "0.6875rem",
                fontWeight: 500,
                color: "#8FA3B8",
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
              }}>
                <SmallSpinner />
                Analyzing…
              </span>
            )}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem 1rem" }}>
            <AnalysisPanel
              analysis={autoAnalyzing ? cachedAnalysis : currentGame.analysis}
              analysisState={autoAnalyzing ? "done" : analysisState}
              currentEntry={currentEntry}
              hasDeepAnalysis={hasDeepAnalysis}
              autoAnalyzing={autoAnalyzing}
              prevFen={prevFen}
              onTriggerAnalysis={handleTriggerAnalysis}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

// Helper components

function PlayerChip({ name, elo, side }: { name: string | null; elo: number | null; side: "white" | "black" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{
        width: 13,
        height: 13,
        borderRadius: "50%",
        background: side === "white" ? "#F5F0E8" : "#0D1B2A",
        border: `1.5px solid ${side === "white" ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)"}`,
        flexShrink: 0,
      }} />
      <span style={{ fontSize: "1rem", fontWeight: 700, color: "#F5F0E8" }}>
        {name ?? "?"}
      </span>
      {elo != null && (
        <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "#8FA3B8" }}>
          {elo}
        </span>
      )}
    </div>
  );
}

function NavBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="btn-ghost"
      style={{
        width: 36, height: 36, padding: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 7, flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function IconFirst() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M3 3v10M13 4L7 8l6 4V4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconPrev() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconNext() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconLast() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M13 3v10M3 4l6 4-6 4V4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconFlip() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M2 8h12M10 5l3 3-3 3M6 11L3 8l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SmallSpinner() {
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
