import { useEffect, useRef } from "react";
import type { MoveEntry, MoveClassification } from "../../types";

const SYMBOL: Record<MoveClassification, string> = {
  brilliant:  "!!",
  best:       "",
  good:       "",
  inaccuracy: "?!",
  mistake:    "?",
  blunder:    "??",
};

const SYMBOL_COLOR: Record<MoveClassification, string> = {
  brilliant:  "#1bada6",
  best:       "#5c8a3e",
  good:       "#5c8a3e",
  inaccuracy: "#d4a017",
  mistake:    "#e07c1c",
  blunder:    "#c41e3a",
};

interface Props {
  entries: MoveEntry[];
  currentMoveIndex: number;
  onSelectMove: (index: number) => void;
}

export function MoveList({ entries, currentMoveIndex, onSelectMove }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentMoveIndex]);

  if (!entries.length) {
    return (
      <div style={{ padding: "1.25rem 0.75rem", color: "#8FA3B8", fontSize: "0.8125rem" }}>
        No moves yet.
      </div>
    );
  }

  const pairs: Array<[MoveEntry, MoveEntry | null]> = [];
  for (let i = 0; i < entries.length; i += 2) {
    pairs.push([entries[i], entries[i + 1] ?? null]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {pairs.map(([white, black], pi) => {
        const wIdx = pi * 2;
        const bIdx = pi * 2 + 1;
        return (
          <div
            key={pi}
            style={{
              display: "grid",
              gridTemplateColumns: "26px 1fr 1fr",
              alignItems: "stretch",
            }}
          >
            <span style={{
              fontSize: "0.75rem",
              color: "#4D6A82",
              fontWeight: 500,
              paddingTop: "0.25rem",
              paddingLeft: "0.25rem",
              lineHeight: 1,
            }}>
              {pi + 1}.
            </span>

            <MoveCell
              entry={white}
              index={wIdx}
              active={currentMoveIndex === wIdx}
              onClick={onSelectMove}
              ref={currentMoveIndex === wIdx ? activeRef : undefined}
            />

            {black ? (
              <MoveCell
                entry={black}
                index={bIdx}
                active={currentMoveIndex === bIdx}
                onClick={onSelectMove}
                ref={currentMoveIndex === bIdx ? activeRef : undefined}
              />
            ) : (
              <span />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface CellProps {
  entry: MoveEntry;
  index: number;
  active: boolean;
  onClick: (i: number) => void;
  ref?: React.Ref<HTMLButtonElement>;
}

function MoveCell({ entry, index, active, onClick, ref }: CellProps) {
  const symbol = entry.classification ? SYMBOL[entry.classification] : "";
  const symbolColor = entry.classification ? SYMBOL_COLOR[entry.classification] : "";

  return (
    <button
      ref={ref}
      onClick={() => onClick(index)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "2px",
        background: active ? "#2563EB" : "transparent",
        border: "none",
        cursor: "pointer",
        padding: "0.2rem 0.375rem",
        borderRadius: 4,
        fontFamily: "'Cabinet Grotesk', sans-serif",
        fontSize: "0.9375rem",
        fontWeight: active ? 700 : 500,
        color: active ? "#fff" : "#F5F0E8",
        transition: "background 0.08s",
        textAlign: "left",
        whiteSpace: "nowrap",
        lineHeight: 1.35,
        boxShadow: active
          ? `inset 3px 0 0 rgba(255,255,255,0.3)`
          : symbolColor
            ? `inset 3px 0 0 ${symbolColor}`
            : "none",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#1A2E45"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {entry.san}
      {symbol && (
        <span style={{
          color: active ? "rgba(255,255,255,0.85)" : symbolColor,
          fontWeight: 800,
          fontSize: "0.8125rem",
          flexShrink: 0,
        }}>
          {symbol}
        </span>
      )}
    </button>
  );
}
