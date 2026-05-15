interface Props {
  eval: number | null;
  height: number;
}

export function EvalBar({ eval: evalVal, height }: Props) {
  const whitePct = (() => {
    if (evalVal == null) return 50;
    const cp = evalVal * 100;
    const winChance = 2 / (1 + Math.exp(-0.00368 * cp)) - 1;
    return Math.round(50 + 50 * winChance);
  })();

  const whiteHeight = Math.round((whitePct / 100) * height);

  const evalLabel = evalVal == null ? null
    : Math.abs(evalVal) >= 90
      ? `M${Math.ceil((999 - Math.abs(evalVal)) / 10)}`
      : (evalVal > 0 ? "+" : "") + evalVal.toFixed(1);

  const whiteWinning = whitePct >= 50;

  return (
    <div style={{
      width: 14,
      height,
      borderRadius: 4,
      overflow: "hidden",
      flexShrink: 0,
      position: "relative",
      background: "#0D1B2A",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
    }}>
      {/* White fill from bottom */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: whiteHeight,
        background: "#F5F0E8",
        transition: "height 0.35s ease",
      }} />

      {/* 50% reference line */}
      <div style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: "50%",
        height: 1,
        background: "rgba(255,255,255,0.2)",
        pointerEvents: "none",
      }} />

      {/* Eval label */}
      {evalLabel && (
        <div style={{
          position: "absolute",
          top: whiteWinning ? 4 : undefined,
          bottom: whiteWinning ? undefined : 4,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}>
          <span style={{
            fontSize: "0.5rem",
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.01em",
            color: whiteWinning ? "#0D1B2A" : "#F5F0E8",
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            userSelect: "none",
          }}>
            {evalLabel}
          </span>
        </div>
      )}
    </div>
  );
}
