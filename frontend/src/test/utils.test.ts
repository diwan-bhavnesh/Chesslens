import { describe, it, expect } from "vitest";

// ── Helpers copied from Dashboard (pure functions worth testing) ──────────────

function getTimeCategory(tc: string | null) {
  if (!tc) return "other";
  const [b = "0", i = "0"] = tc.split("+");
  const tot = parseInt(b) + parseInt(i) * 40;
  if (tot < 180)  return "bullet";
  if (tot < 480)  return "blitz";
  if (tot < 1500) return "rapid";
  return "classical";
}

function isWithinDays(dateStr: string | null, days: number) {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() >= Date.now() - days * 86_400_000;
}

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Accuracy helpers (from analysis.py, mirrored in frontend logic) ──────────

function winProb(evalPawns: number): number {
  const cp = evalPawns * 100;
  return 100.0 / (1.0 + Math.exp(-0.00368 * cp));
}

function moveAccuracy(wpLoss: number): number {
  wpLoss = Math.max(0, Math.min(100, wpLoss));
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * wpLoss) - 3.1668));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// Time controls are stored in seconds (Chess.com API format).
// e.g. "60+0" = 1 min bullet, "180+0" = 3 min blitz, "600+0" = 10 min rapid
describe("getTimeCategory", () => {
  it("classifies bullet correctly", () => {
    expect(getTimeCategory("60+0")).toBe("bullet");   // 1 min
    expect(getTimeCategory("60+1")).toBe("bullet");   // 1+1, tot = 60+40 = 100
    expect(getTimeCategory("120+1")).toBe("bullet");  // 2+1, tot = 120+40 = 160
  });

  it("classifies blitz correctly", () => {
    expect(getTimeCategory("180+0")).toBe("blitz");   // 3 min
    expect(getTimeCategory("300+0")).toBe("blitz");   // 5 min
    expect(getTimeCategory("300+2")).toBe("blitz");   // 5+2, tot = 300+80 = 380
  });

  it("classifies rapid correctly", () => {
    expect(getTimeCategory("600+0")).toBe("rapid");   // 10 min
    expect(getTimeCategory("900+10")).toBe("rapid");  // 15+10, tot = 900+400 = 1300
  });

  it("classifies classical correctly", () => {
    expect(getTimeCategory("1800+20")).toBe("classical"); // 30+20, tot = 1800+800 = 2600
    expect(getTimeCategory("3600+0")).toBe("classical");  // 60 min
  });

  it("returns other for null or empty", () => {
    expect(getTimeCategory(null)).toBe("other");
    expect(getTimeCategory("")).toBe("other");
  });
});

describe("isWithinDays", () => {
  it("returns false for null date", () => {
    expect(isWithinDays(null, 30)).toBe(false);
  });

  it("returns true for today's date within 30 days", () => {
    const today = new Date().toISOString();
    expect(isWithinDays(today, 30)).toBe(true);
  });

  it("returns false for date older than the window", () => {
    const old = new Date(Date.now() - 400 * 86_400_000).toISOString();
    expect(isWithinDays(old, 30)).toBe(false);
  });
});

describe("formatDate", () => {
  it("returns — for null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("returns a non-empty string for a valid date", () => {
    const result = formatDate("2024-01-15T00:00:00Z");
    expect(result).toBeTruthy();
    expect(result).not.toBe("—");
  });
});

describe("winProb", () => {
  it("returns ~50 for eval 0", () => {
    expect(winProb(0)).toBeCloseTo(50, 1);
  });

  it("returns > 50 for positive eval", () => {
    expect(winProb(1)).toBeGreaterThan(50);
    expect(winProb(3)).toBeGreaterThan(70);
  });

  it("returns < 50 for negative eval", () => {
    expect(winProb(-1)).toBeLessThan(50);
  });

  it("approaches 100 for very large eval", () => {
    expect(winProb(10)).toBeGreaterThan(95);
  });
});

describe("moveAccuracy", () => {
  it("returns ~100 for zero win-prob loss", () => {
    expect(moveAccuracy(0)).toBeCloseTo(100, 0);
  });

  it("decreases as wp loss increases", () => {
    expect(moveAccuracy(10)).toBeGreaterThan(moveAccuracy(30));
    expect(moveAccuracy(30)).toBeGreaterThan(moveAccuracy(60));
  });

  it("clamps to 0 for large wp loss", () => {
    expect(moveAccuracy(100)).toBeGreaterThanOrEqual(0);
    expect(moveAccuracy(100)).toBeLessThanOrEqual(10);
  });
});
