import React, { memo } from "react";
import { Chessboard } from "react-chessboard";

interface Props {
  fen: string;
  orientation?: "white" | "black";
  lastMoveSquares?: [string, string] | null;
  boardWidth?: number;
  bestMoveArrow?: [string, string] | null;
}

const LAST_MOVE_STYLE: React.CSSProperties = {
  backgroundColor: "rgba(212, 168, 67, 0.45)",
};

function ChessBoardInner({ fen, orientation = "white", lastMoveSquares, boardWidth, bestMoveArrow }: Props) {
  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (lastMoveSquares) {
    customSquareStyles[lastMoveSquares[0]] = LAST_MOVE_STYLE;
    customSquareStyles[lastMoveSquares[1]] = LAST_MOVE_STYLE;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arrows: any[] = bestMoveArrow
    ? [[bestMoveArrow[0], bestMoveArrow[1], "rgba(37,99,235,0.85)"]]
    : [];

  return (
    <Chessboard
      position={fen}
      boardOrientation={orientation}
      animationDuration={180}
      arePiecesDraggable={false}
      boardWidth={boardWidth}
      customSquareStyles={customSquareStyles}
      customArrows={arrows}
      showBoardNotation={true}
      customNotationStyle={{ color: "#4D6A82", fontWeight: 600, fontSize: "0.625rem" }}
      customBoardStyle={{
        borderRadius: "6px",
        boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
      }}
    />
  );
}

export const ChessBoard = memo(ChessBoardInner);
