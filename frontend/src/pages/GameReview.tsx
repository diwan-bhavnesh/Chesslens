import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { useChessGame } from "../hooks/useChessGame";
import { ChessBoard } from "../components/chess/ChessBoard";
import { MoveList } from "../components/chess/MoveList";
import { AnalysisPanel } from "../components/chess/AnalysisPanel";
import { EvalBar } from "../components/chess/EvalBar";

type AnalysisState = "none" | "running" | "done" | "failed";

const calcBoardSize = () => Math.max(300, Math.min(window.innerHeight - 220, 560));

export function GameReview() {
  const { id } = useParams<{ id: string }>();
  const { currentGame, fetchGame, triggerAnalysis } = useGameStore();
  const [localLoading, setLocalLoading] = useState(true);

  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [boardSize, setBoardSize] = useState(calcBoardSize);

  useEffect(() => {
    if (!id) return;
    setLocalLoading(true);
    fetchGame(id).finally(() => setLocalLoading(false));
  }, [id]);

  useEffect(() => {
    const handler = () => setBoardSize(calcBoardSize());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

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

  const handleTriggerAnalysis = useCallback(async () => {
    if (!id) return;
    await triggerAnalysis(id);
    await fetchGame(id);
  }, [id, triggerAnalysis, fetchGame]);

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

          {/* Nav controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "0.25rem" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              background: "#1A2E45",
              borderRadius: 8,
              padding: "3px 8px 3px 4px",
              gap: 2,
            }}>
              <NavBtn onClick={goToStart} title="Start (↑)"><IconFirst /></NavBtn>
              <NavBtn onClick={goBack}    title="Previous (←)"><IconPrev /></NavBtn>
              <NavBtn onClick={goForward} title="Next (→)"><IconNext /></NavBtn>
              <NavBtn onClick={goToEnd}   title="End (↓)"><IconLast /></NavBtn>
              <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.15)", margin: "0 4px" }} />
              <NavBtn onClick={() => setOrientation(o => o === "white" ? "black" : "white")} title="Flip board">
                <IconFlip />
              </NavBtn>
              <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.15)", margin: "0 4px" }} />
              <span style={{ fontSize: "0.625rem", color: "#8FA3B8", fontWeight: 500, letterSpacing: "0.02em", userSelect: "none" }}>← →</span>
            </div>
          </div>

          {/* Position counter */}
          <div style={{ textAlign: "center", fontSize: "0.6875rem", color: "#4D6A82", letterSpacing: "0.03em" }}>
            {currentMoveIndex < 0 ? "Start" : `Move ${currentMoveIndex + 1} / ${entries.length}`}
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
            {analysisState === "done" && (
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
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem 1rem" }}>
            <AnalysisPanel
              analysis={currentGame.analysis}
              analysisState={analysisState}
              currentEntry={currentEntry}
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
        width: 30, height: 30, padding: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 5, flexShrink: 0,
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
