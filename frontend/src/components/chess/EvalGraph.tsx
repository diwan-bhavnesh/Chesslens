import type { MoveEntry } from "../../types";

const CAP = 6;
const VW = 300;
const VH = 52;
const MID = VH / 2;

function clamp(v: number | null): number {
  if (v === null) return 0;
  if (Math.abs(v) >= 90) return v > 0 ? CAP : -CAP;
  return Math.max(-CAP, Math.min(CAP, v));
}

interface Props {
  entries: MoveEntry[];
  currentMoveIndex: number;
  onSelectMove: (index: number) => void;
}

export function EvalGraph({ entries, currentMoveIndex, onSelectMove }: Props) {
  const hasEval = entries.some(e => e.eval_after !== null);
  if (!hasEval || entries.length < 2) return null;

  const pts = [0, ...entries.map(e => clamp(e.eval_after))];
  const n = pts.length;

  const toX = (i: number) => ((i / (n - 1)) * VW).toFixed(1);
  const toY = (v: number) => (MID - (v / CAP) * MID).toFixed(1);

  const lineStr = pts.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
  const areaPath =
    `M ${toX(0)},${MID} L ` +
    pts.map((v, i) => `${toX(i)},${toY(v)}`).join(" L ") +
    ` L ${toX(n - 1)},${MID} Z`;

  const curX = toX(Math.max(0, currentMoveIndex + 1));

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ptIdx = Math.round(((e.clientX - rect.left) / rect.width) * (n - 1));
    onSelectMove(Math.min(entries.length - 1, Math.max(-1, ptIdx - 1)));
  };

  return (
    <div style={{ width: "100%", cursor: "crosshair" }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: VH, display: "block", borderRadius: 4 }}
        onClick={handleClick}
      >
        <defs>
          <clipPath id="eg-above">
            <rect x="0" y="0" width={VW} height={MID} />
          </clipPath>
          <clipPath id="eg-below">
            <rect x="0" y={MID} width={VW} height={MID} />
          </clipPath>
        </defs>

        {/* Background: lighter navy above (white winning), darker below (black winning) */}
        <rect width={VW} height={MID} fill="#1A2E45" />
        <rect x="0" y={MID} width={VW} height={MID} fill="#112236" />

        {/* Filled area */}
        <path d={areaPath} fill="#2563EB" opacity="0.25" clipPath="url(#eg-above)" />
        <path d={areaPath} fill="#F5F0E8" opacity="0.12" clipPath="url(#eg-below)" />

        {/* Zero line */}
        <line x1="0" y1={MID} x2={VW} y2={MID} stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />

        {/* Eval line */}
        <polyline points={lineStr} fill="none" stroke="#2563EB" strokeWidth="1.25" />

        {/* Current move indicator */}
        <line x1={curX} y1="0" x2={curX} y2={VH} stroke="#2563EB" strokeWidth="1" opacity="0.7" />
      </svg>
    </div>
  );
}
