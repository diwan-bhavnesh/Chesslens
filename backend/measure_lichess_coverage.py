"""
Phase 0: Coverage gate — measure Lichess Cloud Eval hit rate by move number.

Reads PGNs from local chesslens.db, extracts post-opening FEN positions
(half-moves 11-50), samples up to MAX_FENS_PER_BUCKET per bucket, and
queries Lichess to determine what fraction it can serve.

FEN generation uses board.fen() — EXACTLY as bulk_analysis and the harvest
will use it, so the measured rate IS the real rate.

Usage:
    cd backend
    python3 measure_lichess_coverage.py
"""

import hashlib
import io
import sqlite3
import time
from collections import defaultdict

import chess
import chess.pgn
import httpx

# ── Config ───────────────────────────────────────────────────────────────────
DB_PATH = "chesslens.db"
MAX_GAMES = 532           # use all available games
MAX_FENS_PER_BUCKET = 50  # per 5-move bucket — more samples for reliable stats
LICHESS_URL = "https://lichess.org/api/cloud-eval"
# Conservative: 1 request per ~0.3s = ~3 req/s. Fine for a one-off diagnostic.
DELAY_BETWEEN_REQUESTS = 0.3  # seconds


def get_pgns(db_path: str, limit: int) -> list[str]:
    conn = sqlite3.connect(db_path)
    rows = conn.execute(
        "SELECT pgn FROM games WHERE pgn IS NOT NULL LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [r[0] for r in rows if r[0]]


def bucket_for_halfmove(half: int) -> str:
    """Map half-move number to a display bucket label (by full move number)."""
    move = half // 2 + 1
    low = ((move - 1) // 5) * 5 + 1
    high = low + 4
    return f"moves {low:2d}–{high:2d}"


def extract_fens(pgns: list[str], max_fens_per_bucket: int) -> dict[str, list[str]]:
    """
    Returns {bucket_label: [fen, ...]} for half-moves 11-50.
    Caps each bucket at max_fens_per_bucket to keep the Lichess call count manageable.
    """
    buckets: dict[str, list[str]] = defaultdict(list)
    bucket_counts: dict[str, int] = defaultdict(int)

    for pgn_text in pgns:
        game = chess.pgn.read_game(io.StringIO(pgn_text))
        if not game:
            continue
        board = game.board()
        half = 0
        for node in game.mainline():
            if half >= 50:
                break
            if half >= 11:
                label = bucket_for_halfmove(half)
                if bucket_counts[label] < max_fens_per_bucket:
                    fen = board.fen()
                    buckets[label].append(fen)
                    bucket_counts[label] += 1
            board.push(node.move)
            half += 1

    return dict(buckets)


def query_lichess(fen: str, client: httpx.Client) -> tuple[bool, int]:
    """
    Returns (hit: bool, depth: int).
    hit=False on any error/404.
    """
    try:
        resp = client.get(
            LICHESS_URL,
            params={"fen": fen, "multiPv": 1},
            timeout=5.0,
        )
        if resp.status_code == 200:
            data = resp.json()
            return True, data.get("depth", 0)
        return False, 0
    except Exception:
        return False, 0


def main():
    print(f"Reading up to {MAX_GAMES} games from {DB_PATH}...")
    pgns = get_pgns(DB_PATH, MAX_GAMES)
    print(f"Loaded {len(pgns)} games.\n")

    print("Extracting FENs (half-moves 11–50)...")
    buckets = extract_fens(pgns, MAX_FENS_PER_BUCKET)

    total_fens = sum(len(v) for v in buckets.values())
    print(f"Extracted {total_fens} FENs across {len(buckets)} buckets.\n")
    print(f"Querying Lichess at ~{1/DELAY_BETWEEN_REQUESTS:.1f} req/s "
          f"(ETA ~{int(total_fens * DELAY_BETWEEN_REQUESTS)}s)...\n")

    results: dict[str, dict] = {}

    with httpx.Client(headers={"User-Agent": "Chesslens-coverage-check/1.0"}) as client:
        for label in sorted(buckets.keys()):
            fens = buckets[label]
            hits = 0
            depths = []
            for fen in fens:
                hit, depth = query_lichess(fen, client)
                if hit:
                    hits += 1
                    depths.append(depth)
                time.sleep(DELAY_BETWEEN_REQUESTS)
            results[label] = {
                "queried": len(fens),
                "hits": hits,
                "rate": hits / len(fens) * 100 if fens else 0,
                "avg_depth": sum(depths) / len(depths) if depths else 0,
            }

    # ── Print report ─────────────────────────────────────────────────────────
    print("=" * 60)
    print(f"{'Bucket':<18} {'Queried':>8} {'Hits':>6} {'Hit%':>7} {'Avg depth':>10}")
    print("-" * 60)
    for label in sorted(results.keys()):
        r = results[label]
        print(
            f"{label:<18} {r['queried']:>8} {r['hits']:>6} "
            f"{r['rate']:>6.1f}% {r['avg_depth']:>10.1f}"
        )
    print("=" * 60)

    all_queried = sum(r["queried"] for r in results.values())
    all_hits = sum(r["hits"] for r in results.values())
    all_depths = [r["avg_depth"] for r in results.values() if r["avg_depth"] > 0]
    overall_rate = all_hits / all_queried * 100 if all_queried else 0
    overall_depth = sum(all_depths) / len(all_depths) if all_depths else 0

    print(f"\nOverall: {all_hits}/{all_queried} = {overall_rate:.1f}% hit rate, "
          f"avg depth {overall_depth:.1f} on hits")

    print("\nRecommendation:")
    if overall_rate >= 60:
        print(f"  ✓ {overall_rate:.0f}% hit rate — architecture is validated. Proceed with Phase 1.")
        # Find cutoff: first bucket below 15%
        cutoff_label = None
        for label in sorted(results.keys()):
            if results[label]["rate"] < 15:
                cutoff_label = label
                break
        if cutoff_label:
            print(f"  Suggested cutoff: stop querying Lichess at {cutoff_label} "
                  f"(hit rate drops below 15%).")
        else:
            print("  All buckets above 15% — consider extending to half-move 60.")
    else:
        print(f"  ✗ {overall_rate:.0f}% hit rate — below threshold. "
              "Investigate FEN convention mismatch (H6) before proceeding.")


if __name__ == "__main__":
    main()
