"""
Migration: clear bulk analysis data so the next profile rebuild
re-analyzes everything with the all-moves depth-5 chain model.

Safe to run — only touches bulk-analyzed rows (not depth-15 game reviews):
  - Identifies bulk-only GameAnalysis rows (no claude_summary, zero blunders/mistakes/inaccuracies)
  - Deletes Move rows for those games (stale sparse data from the old critical-position filter)
  - Nulls accuracy_white/accuracy_black on those GameAnalysis rows
  - Clears fen_eval_cache (positions re-evaluated on next run)
  - Resets player_profiles status to 'pending' so Dashboard triggers a rebuild

Run from the backend/ directory:
    python3 reset_bulk_analysis.py
"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "chesslens.db")
if not os.path.exists(db_path):
    print(f"ERROR: {db_path} not found")
    exit(1)

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# 1. Identify bulk-only game IDs (no claude_summary, zero blunders/mistakes/inaccuracies)
#    Depth-15 games have real blunder/mistake counts or a claude_summary — these are preserved.
cur.execute("""
    SELECT game_id FROM game_analyses
    WHERE claude_summary IS NULL
      AND (blunders_white = 0 OR blunders_white IS NULL)
      AND (mistakes_white = 0 OR mistakes_white IS NULL)
      AND (inaccuracies_white = 0 OR inaccuracies_white IS NULL)
""")
bulk_game_ids = [row[0] for row in cur.fetchall()]
print(f"Found {len(bulk_game_ids)} bulk-only games to reset")

# 2. Delete stale Move rows for bulk-only games (sparse critical-position data)
#    Depth-15 Move rows are in different games (not in bulk_game_ids) — unaffected.
if bulk_game_ids:
    placeholders = ",".join("?" * len(bulk_game_ids))
    cur.execute(f"SELECT COUNT(*) FROM moves WHERE game_id IN ({placeholders})", bulk_game_ids)
    move_count = cur.fetchone()[0]
    cur.execute(f"DELETE FROM moves WHERE game_id IN ({placeholders})", bulk_game_ids)
    print(f"✓  Deleted {move_count} stale bulk Move rows")
else:
    print("✓  No Move rows to delete")

# 3. Null out accuracy on bulk-only GameAnalysis rows
cur.execute("""
    UPDATE game_analyses
    SET accuracy_white = NULL,
        accuracy_black = NULL,
        status = 'pending'
    WHERE claude_summary IS NULL
      AND (blunders_white = 0 OR blunders_white IS NULL)
      AND (mistakes_white = 0 OR mistakes_white IS NULL)
      AND (inaccuracies_white = 0 OR inaccuracies_white IS NULL)
""")
bulk_reset = cur.rowcount
print(f"✓  Reset {bulk_reset} bulk GameAnalysis rows → status=pending, accuracy=NULL")

# 4. Clear FEN eval cache — positions re-evaluated at depth-5 on next run
cur.execute("SELECT COUNT(*) FROM fen_eval_cache")
cache_count = cur.fetchone()[0]
cur.execute("DELETE FROM fen_eval_cache")
print(f"✓  Cleared fen_eval_cache ({cache_count} rows)")

# 5. Reset player_profiles so Dashboard triggers a rebuild
cur.execute("""
    UPDATE player_profiles
    SET status = 'pending',
        accuracy_history = NULL,
        games_done = NULL,
        games_total = NULL
""")
profiles_reset = cur.rowcount
print(f"✓  Reset {profiles_reset} player profile(s) → status=pending, accuracy=NULL")

conn.commit()
conn.close()

print("\nDone. Dashboard will auto-trigger a rebuild when you next open it.")
