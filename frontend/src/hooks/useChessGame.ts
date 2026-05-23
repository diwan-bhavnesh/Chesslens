import { useState, useCallback, useMemo, useEffect } from "react";
import { Chess } from "chess.js";
import type { Move, MoveEntry } from "../types";

export function useChessGame(pgn: string, analyzedMoves: Move[]) {
  const entries = useMemo<MoveEntry[]>(() => {
    if (!pgn) return [];

    let verboseMoves: ReturnType<Chess["history"]>;
    try {
      const loader = new Chess();
      loader.loadPgn(pgn);
      verboseMoves = loader.history({ verbose: true });
    } catch {
      return [];
    }

    const replay = new Chess();
    const raw: MoveEntry[] = [];

    for (let i = 0; i < verboseMoves.length; i++) {
      const vm = verboseMoves[i] as {
        san: string; from: string; to: string; color: string; promotion?: string;
      };
      replay.move(vm.san);
      raw.push({
        san: vm.san,
        fen: replay.fen(),
        color: vm.color === "w" ? "white" : "black",
        moveNumber: Math.floor(i / 2) + 1,
        uci: vm.from + vm.to + (vm.promotion ?? ""),
        classification: null,
        eval_before: null,
        eval_after: null,
        best_move: null,
        comment: null,
      });
    }

    if (!analyzedMoves.length) return raw;

    const analysisMap = new Map(
      analyzedMoves.map((m) => [`${m.move_number}-${m.color}`, m])
    );
    return raw.map((entry) => {
      const a = analysisMap.get(`${entry.moveNumber}-${entry.color}`);
      if (!a) return entry;
      return {
        ...entry,
        classification: a.classification,
        eval_before: a.eval_before,
        eval_after: a.eval_after,
        best_move: a.best_move,
        comment: a.comment,
      };
    });
  }, [pgn, analyzedMoves]);

  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);

  // Reset to start when a different game is loaded
  useEffect(() => {
    setCurrentMoveIndex(-1);
  }, [pgn]);

  const startFen = useMemo(() => new Chess().fen(), []);

  const currentFen =
    currentMoveIndex >= 0 ? entries[currentMoveIndex]?.fen ?? startFen : startFen;

  const currentEntry = currentMoveIndex >= 0 ? entries[currentMoveIndex] ?? null : null;

  const goToMove = useCallback(
    (index: number) => {
      setCurrentMoveIndex(Math.min(Math.max(-1, index), entries.length - 1));
    },
    [entries.length]
  );

  const goForward = useCallback(() => {
    setCurrentMoveIndex((i) => Math.min(i + 1, entries.length - 1));
  }, [entries.length]);

  const goBack = useCallback(() => {
    setCurrentMoveIndex((i) => Math.max(i - 1, -1));
  }, []);

  const goToStart = useCallback(() => setCurrentMoveIndex(-1), []);
  const goToEnd = useCallback(
    () => setCurrentMoveIndex(entries.length - 1),
    [entries.length]
  );

  return {
    entries,
    currentFen,
    currentEntry,
    currentMoveIndex,
    goToMove,
    goForward,
    goBack,
    goToStart,
    goToEnd,
  };
}
