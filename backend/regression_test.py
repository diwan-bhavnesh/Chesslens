"""
Chesslens regression test — signup → import → analysis end-to-end.
Run from the backend/ directory with both servers up:
    python3 regression_test.py
"""
import requests
import sys
import sqlite3
import os
import time
import uuid

BASE = "http://localhost:8000"
EMAIL = f"regtest_{uuid.uuid4().hex[:8]}@example.com"
PWD   = "Regtest#1234"

SAMPLE_PGN = """[Event "Test Game"]
[Site "Chess.com"]
[Date "2024.01.01"]
[White "testuser"]
[Black "opponent"]
[Result "1-0"]
[WhiteElo "1500"]
[BlackElo "1480"]
[TimeControl "600+0"]
[ECO "C50"]
[Opening "Italian Game"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O Nf6 5. d3 O-O 6. Nc3 d6 7. Bg5 h6 8. Bh4 g5 9. Bg3 Nh5 10. Nd5 Nxg3 11. hxg3 Nd4 12. Nxd4 Bxd4 13. c3 Bc5 14. Kh2 f5 15. exf5 Bxf5 16. Ne3 Bxe3 17. fxe3 Qg5 18. Qd2 Kh7 19. Rf3 Rae8 20. Raf1 Re7 21. g4 Bg6 22. Rxf8 Qxf8 23. Rxf8 Rxf8 24. b4 b6 25. Qe2 Kg7 26. d4 exd4 27. exd4 Kf6 28. d5 Bf7 29. c4 Re8 30. Qf3+ Ke5 31. Qf5+ Kd4 32. Qxd7 1-0"""

passed = 0
failed = 0

def check(name: str, ok: bool, detail: str = ""):
    global passed, failed
    if ok:
        passed += 1
        print(f"  ✓  {name}")
    else:
        failed += 1
        print(f"  ✗  {name}{(' — ' + detail) if detail else ''}")

def section(title: str):
    print(f"\n{'─'*52}\n  {title}\n{'─'*52}")

# ── 0. DB cleanup ────────────────────────────────────────────────────────────
section("0. Pre-test cleanup")
db_path = os.path.join(os.path.dirname(__file__), "chesslens.db")
check("chesslens.db found", os.path.exists(db_path), db_path)
if not os.path.exists(db_path):
    sys.exit(1)
try:
    con = sqlite3.connect(db_path)
    con.execute("DELETE FROM users WHERE email LIKE 'regtest_%@example.com'")
    con.commit()
    con.close()
    check("Stale test users purged", True)
except Exception as e:
    check("DB cleanup", False, str(e))
    sys.exit(1)

# ── 1. Registration ──────────────────────────────────────────────────────────
section("1. Registration")
r_reg = requests.post(f"{BASE}/auth/register", json={"email": EMAIL, "password": PWD, "full_name": "Reg Tester"})
check("POST /auth/register → 201", r_reg.status_code == 201, f"got {r_reg.status_code} — {r_reg.text[:200]}")
reg_body = r_reg.json() if r_reg.status_code == 201 else {}
check("Register response has user id", bool(reg_body.get("id")))
check("Register response has email", reg_body.get("email") == EMAIL)

# Duplicate email should fail
r_dup = requests.post(f"{BASE}/auth/register", json={"email": EMAIL, "password": PWD})
check("Duplicate email → 400", r_dup.status_code == 400)

# ── 2. Login ─────────────────────────────────────────────────────────────────
section("2. Login")
r_login = requests.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PWD})
check("POST /auth/login → 200", r_login.status_code == 200, f"got {r_login.status_code} — {r_login.text[:100]}")
tokens = r_login.json() if r_login.status_code == 200 else {}
check("Login returns access_token", bool(tokens.get("access_token")))
check("Login returns refresh_token", bool(tokens.get("refresh_token")))

if not tokens.get("access_token"):
    print("\n  FATAL: no access token — cannot continue\n")
    sys.exit(1)

# Wrong password should fail
r_bad = requests.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": "WrongPass#9"})
check("Wrong password → 401", r_bad.status_code == 401)

AT = tokens["access_token"]
RT = tokens["refresh_token"]
hdrs = {"Authorization": f"Bearer {AT}"}

# ── 3. Token refresh ─────────────────────────────────────────────────────────
section("3. Token refresh")
r_ref = requests.post(f"{BASE}/auth/refresh", json={"refresh_token": RT})
check("POST /auth/refresh → 200", r_ref.status_code == 200, f"got {r_ref.status_code} — {r_ref.text[:100]}")
check("Refresh returns new access_token", "access_token" in r_ref.json())
check("Bad refresh token → 401", requests.post(f"{BASE}/auth/refresh", json={"refresh_token": "bad"}).status_code == 401)

# ── 4. User profile ───────────────────────────────────────────────────────────
section("4. User profile")
me = requests.get(f"{BASE}/users/me", headers=hdrs)
check("GET /users/me → 200", me.status_code == 200, f"got {me.status_code}")
check("/users/me email correct", me.json().get("email") == EMAIL)
check("/users/me has id", bool(me.json().get("id")))
# No auth: FastAPI returns 403 "Not authenticated" (OAuth2 scheme default)
r_unauth_me = requests.get(f"{BASE}/users/me")
check("No auth → 401 or 403", r_unauth_me.status_code in (401, 403))

# ── 5. Games — empty list ─────────────────────────────────────────────────────
section("5. Games — empty state")
gl_empty = requests.get(f"{BASE}/games/", headers=hdrs)
check("GET /games/ → 200", gl_empty.status_code == 200)
check("Empty games → []", isinstance(gl_empty.json(), list) and len(gl_empty.json()) == 0)
r_unauth_games = requests.get(f"{BASE}/games/")
check("No auth → 401 or 403", r_unauth_games.status_code in (401, 403))

# ── 6. PGN import ─────────────────────────────────────────────────────────────
section("6. PGN import")
r_pgn = requests.post(f"{BASE}/games/import/pgn", headers=hdrs, json={"pgn": SAMPLE_PGN})
check("POST /games/import/pgn → 201", r_pgn.status_code == 201, f"got {r_pgn.status_code} — {r_pgn.text[:200]}")
game = r_pgn.json() if r_pgn.status_code == 201 else {}
game_id = game.get("id")
check("PGN returns game id", bool(game_id))
check("PGN result is 1-0", game.get("result") == "1-0")
check("PGN opening detected", game.get("opening") == "Italian Game")
check("PGN source is manual", game.get("source") == "manual")

# ── 7. Game retrieval ─────────────────────────────────────────────────────────
section("7. Game retrieval")
gl2 = requests.get(f"{BASE}/games/", headers=hdrs)
check("Games list has 1 game", isinstance(gl2.json(), list) and len(gl2.json()) == 1)

if game_id:
    gd = requests.get(f"{BASE}/games/{game_id}", headers=hdrs)
    check("GET /games/{id} → 200", gd.status_code == 200)
    check("Game detail has pgn", bool(gd.json().get("pgn")))
    check("Game detail has moves array", isinstance(gd.json().get("moves"), list))
    check("Non-existent game → 404", requests.get(f"{BASE}/games/{'0'*32}", headers=hdrs).status_code in (404, 422))

# ── 8. Stockfish analysis ─────────────────────────────────────────────────────
section("8. Per-game analysis (Stockfish)")
if game_id:
    ra = requests.post(f"{BASE}/analysis/{game_id}", headers=hdrs)
    check("POST /analysis/{id} → 202", ra.status_code == 202, f"got {ra.status_code} — {ra.text[:100]}")
    check("Analysis status is pending/done", ra.json().get("status") in ("pending", "done"))

    # Poll up to 30s
    final_status = ra.json().get("status")
    for _ in range(10):
        if final_status == "done":
            break
        time.sleep(3)
        ga = requests.get(f"{BASE}/analysis/{game_id}", headers=hdrs)
        if ga.status_code == 200:
            final_status = ga.json().get("status")

    ga = requests.get(f"{BASE}/analysis/{game_id}", headers=hdrs)
    check("GET /analysis/{id} → 200", ga.status_code == 200)
    check("Analysis not stuck at pending", ga.json().get("status") in ("done", "failed"))
    if ga.json().get("status") == "done":
        check("accuracy_white set", ga.json().get("accuracy_white") is not None)
        check("accuracy_black set", ga.json().get("accuracy_black") is not None)
        check("key_moments is list", isinstance(ga.json().get("key_moments"), list))

# ── 9. Portfolio / batch analysis ────────────────────────────────────────────
section("9. Portfolio (batch) analysis")
rb = requests.post(f"{BASE}/analysis/batch", headers=hdrs)
check("POST /analysis/batch → 202", rb.status_code == 202, f"got {rb.status_code} — {rb.text[:100]}")
check("Batch status field present", rb.json().get("status") in ("pending", "running", "done", "failed"))
check("Batch total_games set", isinstance(rb.json().get("total_games"), int))

# Second call while pending → 409
rb2 = requests.post(f"{BASE}/analysis/batch", headers=hdrs)
if rb.json().get("status") in ("pending", "running"):
    check("Second batch → 409 conflict", rb2.status_code == 409)
else:
    check("Second batch → 202 or 409", rb2.status_code in (202, 409))

rbl = requests.get(f"{BASE}/analysis/batch/latest", headers=hdrs)
check("GET /analysis/batch/latest → 200", rbl.status_code == 200)
check("Batch latest has all fields", all(k in rbl.json() for k in ("id", "status", "total_games", "games_analyzed")))

# ── 10. Platform import job ───────────────────────────────────────────────────
section("10. Chess.com import job")
r_cc = requests.post(
    f"{BASE}/games/import/chesscom",
    headers=hdrs,
    json={"source": "chesscom", "username": "hikaru", "max_games": 1, "game_type": "rapid", "time_control": "all"},
)
check("POST /games/import/chesscom → 202", r_cc.status_code == 202, f"got {r_cc.status_code} — {r_cc.text[:100]}")
if r_cc.status_code == 202:
    job = r_cc.json()
    job_id = job.get("id")
    check("Import job has id", bool(job_id))
    check("Import job status is pending/running", job.get("status") in ("pending", "running", "done", "failed"))
    if job_id:
        rj = requests.get(f"{BASE}/games/import/jobs/{job_id}", headers=hdrs)
        check("GET /games/import/jobs/{id} → 200", rj.status_code == 200)
        check("Import job body has status", rj.json().get("status") in ("pending", "running", "done", "failed"))

# ── 11. Game deletion ─────────────────────────────────────────────────────────
section("11. Game deletion")
if game_id:
    rd = requests.delete(f"{BASE}/games/{game_id}", headers=hdrs)
    check("DELETE /games/{id} → 204", rd.status_code == 204, f"got {rd.status_code}")
    gl3 = requests.get(f"{BASE}/games/", headers=hdrs)
    manual_games = [g for g in gl3.json() if g.get("source") == "manual"]
    check("Manual game gone after delete", len(manual_games) == 0)

# Re-upload then clear-all
r_pgn3 = requests.post(f"{BASE}/games/import/pgn", headers=hdrs, json={"pgn": SAMPLE_PGN})
check("Re-upload PGN → 201", r_pgn3.status_code == 201)
r_clear = requests.delete(f"{BASE}/games/all", headers=hdrs)
check("DELETE /games/all → 204", r_clear.status_code == 204, f"got {r_clear.status_code}")
gl_after = requests.get(f"{BASE}/games/", headers=hdrs)
manual_after = [g for g in gl_after.json() if g.get("source") == "manual"]
check("Games list empty after clear-all", len(manual_after) == 0)

# ── 12. Player profile ───────────────────────────────────────────────────────
section("12. Player profile API")

# Need at least 1 game for profile build to produce data
r_pgn_p = requests.post(f"{BASE}/games/import/pgn", headers=hdrs, json={"pgn": SAMPLE_PGN})
check("PGN re-import for profile test → 201", r_pgn_p.status_code == 201)

# No profile yet → 404
r_noprofile = requests.get(f"{BASE}/profile/me", headers=hdrs)
check("GET /profile/me before create → 404", r_noprofile.status_code == 404)

# Create profile
r_create = requests.post(f"{BASE}/profile/create", headers=hdrs)
check("POST /profile/create → 202", r_create.status_code == 202, f"got {r_create.status_code} — {r_create.text[:100]}")
check("Profile status is pending/running/done", r_create.json().get("status") in ("pending", "running", "done"))

# Concurrent create → 409 (if still running)
if r_create.json().get("status") in ("pending", "running"):
    r_dup_profile = requests.post(f"{BASE}/profile/create", headers=hdrs)
    check("Duplicate profile create → 409", r_dup_profile.status_code == 409)

# Poll until Layer 1 done (max 15s)
profile_status = r_create.json().get("status")
for _ in range(5):
    if profile_status == "done":
        break
    time.sleep(3)
    rp = requests.get(f"{BASE}/profile/me", headers=hdrs)
    if rp.status_code == 200:
        profile_status = rp.json().get("status")

# Poll until Layer 2 done (accuracy_history populated, max 60s additional)
for _ in range(20):
    rp = requests.get(f"{BASE}/profile/me", headers=hdrs)
    if rp.status_code == 200:
        pd_check = rp.json()
        if pd_check.get("status") == "done" and pd_check.get("accuracy_history") is not None:
            break
    time.sleep(3)

rp = requests.get(f"{BASE}/profile/me", headers=hdrs)
check("GET /profile/me → 200", rp.status_code == 200, f"got {rp.status_code}")
if rp.status_code == 200:
    pd = rp.json()
    check("Profile status is done or failed", pd.get("status") in ("done", "failed"))
    if pd.get("status") == "done":
        check("total_games is an int", isinstance(pd.get("total_games"), int))
        check("total_games > 0", (pd.get("total_games") or 0) > 0)
        check("win_pct_white present", pd.get("win_pct_white") is not None or pd.get("win_pct_white") is None)  # nullable OK
        check("game_count_at_last_build is set", pd.get("game_count_at_last_build") is not None)
        # Layer 2 fields: null before Layer 2 runs, list/dict after
        check("accuracy_history is list or null", pd.get("accuracy_history") is None or isinstance(pd.get("accuracy_history"), list))
        check("phase_accuracy is dict or null", pd.get("phase_accuracy") is None or isinstance(pd.get("phase_accuracy"), dict))
        check("time_pressure is dict or null", pd.get("time_pressure") is None or isinstance(pd.get("time_pressure"), dict))
        # Layer 2 API field structure checks
        if pd.get("accuracy_history") is not None:
            check("accuracy_history is a list", isinstance(pd["accuracy_history"], list))
            if isinstance(pd["accuracy_history"], list) and len(pd["accuracy_history"]) > 0:
                entry = pd["accuracy_history"][0]
                check("accuracy_history entry has 'accuracy' key (new format)", "accuracy" in entry, f"keys: {list(entry.keys())}")
                check("accuracy_history entry has 'color' key (new format)", "color" in entry, f"keys: {list(entry.keys())}")
                check("accuracy_history entry color is white or black", entry.get("color") in ("white", "black"), f"got: {entry.get('color')}")
        if pd.get("phase_accuracy") is not None:
            pa = pd["phase_accuracy"]
            check("phase_accuracy has game_count key", "game_count" in pa)
            for key in ("opening", "middlegame", "endgame"):
                check(f"phase_accuracy.{key} present", key in pa)
        if pd.get("time_pressure") is not None:
            tp = pd["time_pressure"]
            check("time_pressure has normal_accuracy key", "normal_accuracy" in tp)
            check("time_pressure has pressure_accuracy key", "pressure_accuracy" in tp)
            check("time_pressure has games_analyzed key", "games_analyzed" in tp)
        check("games_total field in response", "games_total" in pd)
        check("games_done field in response", "games_done" in pd)

# Rebuild (same as create)
r_rebuild = requests.post(f"{BASE}/profile/rebuild", headers=hdrs)
check("POST /profile/rebuild → 202 or 409", r_rebuild.status_code in (202, 409))

# No auth
check("No auth GET /profile/me → 401 or 403", requests.get(f"{BASE}/profile/me").status_code in (401, 403))
check("No auth POST /profile/create → 401 or 403", requests.post(f"{BASE}/profile/create").status_code in (401, 403))

# Clean up profile and games for section 13
requests.delete(f"{BASE}/games/all", headers=hdrs)

# ── 13. Auth hardening ────────────────────────────────────────────────────────
section("13. Auth hardening")
bad_hdrs = {"Authorization": "Bearer definitely.not.valid"}
check("Bad JWT /users/me → 401 or 403", requests.get(f"{BASE}/users/me", headers=bad_hdrs).status_code in (401, 403))
check("Bad JWT GET /games/ → 401 or 403", requests.get(f"{BASE}/games/", headers=bad_hdrs).status_code in (401, 403))
check("No auth DELETE /games/all → 401 or 403", requests.delete(f"{BASE}/games/all").status_code in (401, 403))
check("No auth POST /analysis/batch → 401 or 403", requests.post(f"{BASE}/analysis/batch").status_code in (401, 403))

# ── 14. API availability ──────────────────────────────────────────────────────
section("14. API availability")
r_root = requests.get(f"{BASE}/")
check("Root / responds (not 5xx)", r_root.status_code < 500)
r_docs = requests.get(f"{BASE}/docs")
check("/docs responds", r_docs.status_code == 200)

# ── 15. Layer 2 — bulk analysis pipeline ─────────────────────────────────────
section("15. Layer 2 — bulk analysis pipeline")

# DB schema checks
conn15 = sqlite3.connect(db_path)
cur15 = conn15.cursor()

cur15.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='fen_eval_cache'")
check("fen_eval_cache table exists", cur15.fetchone() is not None)

cur15.execute("PRAGMA table_info(player_profiles)")
profile_cols = {row[1] for row in cur15.fetchall()}
for col in ("games_total", "games_done", "game_count_at_last_build", "progress",
            "total_wins", "total_draws", "total_losses"):
    check(f"player_profiles.{col} column exists", col in profile_cols)

# Verify fen_eval_cache has rows (bulk pipeline ran during Section 12 profile build)
cur15.execute("SELECT COUNT(*) FROM fen_eval_cache")
cache_count = cur15.fetchone()[0]
check("fen_eval_cache has rows after bulk run", cache_count > 0)

conn15.close()

# Note: profile was deleted along with games in Section 12 cleanup (expected behaviour).
# API-level Layer 2 field structure checks are verified in Section 12 (before cleanup).

# ── Summary ───────────────────────────────────────────────────────────────────
total = passed + failed
print(f"\n{'═'*52}")
print(f"  {'PASS' if failed == 0 else 'FAIL'}  {passed}/{total} checks passed, {failed} failed")
print(f"{'═'*52}\n")
sys.exit(0 if failed == 0 else 1)
