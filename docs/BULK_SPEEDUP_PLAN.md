# Chesslens — Bulk-Analysis Speedup Plan

> **Status:** Plan locked (Session 22, 2026-06-29). Not yet implemented. Resume next session.
> **Goal:** Speed up Layer 2 bulk accuracy analysis. Stretch target: 500 games in ≤15s. Constraint: no additional cost. Assumption: single-user (personal) for now.

---

## 1. Problem

Bulk analysis (Layer 2) scores every game for accuracy (Dashboard + My Games %). It runs on Fly.io's **single shared CPU core**, one position at a time → ~24 min for 500 games, and often killed mid-run (Session 20 bug). Work is fixed at **500 games ≈ 28,500 position evaluations**.

## 2. The unlock

Run the analysis **on the Mac (12 cores), in parallel**, instead of Fly's 1 core. ~9× faster, zero cost (hardware already owned). The current code is single-threaded — that's the waste.

## 3. Measured ground truth (on this Mac, Stockfish 18)

- **57 analyzed positions/game** → 500 games = **28,500 searches**.
- **Position dedupe = 1% only** (99% unique). Caching-for-reuse is dead; removed from plan.
- **Single-core speed:** d8 116/s · d10 54/s · d12 38/s · d15 8.2/s · d18 1.8/s.
- **Parallel:** ~9× realistic on 12 cores (exact number not yet benchmarked).

## 4. The hard trade-off: speed OR depth, not both

| Depth | Quality | Full 500 games | Fits in 15s |
|---|---|---|---|
| 8 | below today | **~27s** | 54% of moves |
| 10 | ≈ today | **~59s** | 25% of moves |
| 12 | better | ~83s | 18% of moves |
| 15 | much better | ~6.4 min | 4% of moves |
| 18 | near-best | ~30 min | 1% of moves |

(Fly today ≈ 24 min for the same job.)

- **≤15s** → only via depth 8 + ~45% move sampling (costs accuracy precision, needs recalibration).
- **Higher depth** → minutes, not seconds.
- **Recommended:** depth 10, full coverage, **~40–60s.** No accuracy loss (preserves Session 14's calibrated 85.4%), still 25–50× faster than today.

## 5. What gets built

**`backend/bulk_analyze_parallel.py`** — standalone module / CLI.

**Both locations (build once):**
- *Now:* CLI on the Mac, against local SQLite.
- *Later:* importable by FastAPI → run unchanged on a multi-core cloud box if multi-user returns. Keeps the SaaS door open.

**Both quality dimensions (runtime flags):**

| Command | 500 games | Use when |
|---|---|---|
| `--mode full --depth 10` | ~40–60s | **Default** — preserves current accuracy |
| `--mode full --depth 8` | ~27s | faster, slightly shallower |
| `--mode fast --depth 8` | ~15s | hard 15s target (samples moves; recalibrate) |
| `--mode adaptive --deep-depth 18` | ~30–60s | depth-8 everywhere + depth-18 on the ~5 swing moves/game |

## 6. Mechanics (all modes)

- `ProcessPoolExecutor`, `cpu_count − 2` workers (~10). One Stockfish per worker (`Threads=1, Hash=128`).
- Partition **whole games** per worker (chain model must stay intact within a game).
- **Depth-based limits**, not time — identical/reproducible results across Mac and cloud.
- Workers compute in memory; parent does **one batched DB write** (SQLite single-writer safe).
- Drop per-position cache read (99% miss); keep cache write for the depth-15 path.

## 7. Safety / scope

- Re-run regression **Section 17** (accuracy calibration) after — required by CLAUDE.md whenever the analysis path changes. Confirms 85.4% holds (full modes) or re-baselines (fast mode).
- Depth-15 **individual Game Review path is untouched** — this only changes bulk Layer 2.

## 8. Deviation flagged & authorized

Running Stockfish on the Mac breaks CLAUDE.md's *"Stockfish runs server-side / no local-only / distributable SaaS."* User relaxed it ("only for myself now"). Module stays server-callable so the SaaS path isn't permanently closed. While local, the cloud app only works when the Mac is on.

---

## Open decisions (resume here next session)

1. **Default mode** — recommend `full --depth 10` (~45s, no accuracy loss). Or force 15s `fast` mode?
2. **Database target** — local SQLite only, or also write back to Fly Postgres so the cloud app reflects results?
3. **Build immediately, or benchmark exact parallel speedup first** (replace ~9× estimate with measured number)?
