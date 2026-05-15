# Chesslens — Personal Chess Game Reviewer
**Version:** 2.0 · Post-MVP | **Status:** Core Build Complete | **Audience:** Individual Chess Players

_Last updated: 2026-05-10 — Session 2 final_

An AI-powered platform that analyses chess games from Chess.com to identify tactical weaknesses, opening patterns, and style-based recommendations — helping players improve systematically.

---

## User Personas

| Persona | Rating | Plays | Goal |
|---------|--------|-------|------|
| **Rahul — The Improver** | 900–1200 | Daily blitz | Stop making the same blunders. Needs clear, actionable feedback on recurring tactical errors. |
| **Sara — The Repertoire Builder** | 1400–1600 | Rapid & classical | Has 2–3 openings but wants to diversify. Needs style-matched opening recommendations. |
| **Arjun — The Analyst** | 1700+ | Competitive club | Tracks progress rigorously. Wants accuracy trends over time and performance comparison across time controls. |

---

## MVP Feature Pillars

| Pillar | Status |
|--------|--------|
| **Opening Analysis** — Identify opening repertoire, playing style, pawn structure patterns | ✅ Built |
| **Opening Recommendations** — Style-matched suggestions with sample move lines | ✅ Built |
| **Tactical Miss Detection** — Stockfish eval gaps surfaced as recurring patterns | ✅ Built |
| **Move-by-Move Game Review** — Full board replay with eval bar, graph, classification | ✅ Built (was out of scope in v1) |
| **Accuracy Tracking** — Per-game accuracy calculated and displayed | ✅ Built (trend chart over time not yet built) |

---

## User Journey

1. **Sign Up & Connect** — User creates an account with email/password. Google OAuth button exists but backend not yet wired.
2. **Configure Import** — User selects a date range, game type, and time control. All available games matching filters are imported (no fixed cap). Fewer than 100 games proceeds with a disclaimer.
3. **Games Fetched & Queued** — System pulls games via API with a live progress indicator. Corrupted or unreadable games are silently skipped.
4. **Stockfish + Claude Analysis** — Two tiers:
   - *Tier 2 (per-game):* User triggers Stockfish analysis per game. Runs as a background job. Status polled silently without page flicker or scroll reset.
   - *Tier 1 (portfolio):* User triggers Claude batch analysis across all games to extract patterns.
5. **Dashboard Presented** — Player sees opening repertoire, playing style, pawn structure tendencies, tactical miss patterns, opening recommendations, and a game library with per-game accuracy.
6. **Filter & Drill Down** — Player filters by platform, result, game type, and date range. Individual games can be opened in full Game Review.

---

## Feature Specifications

### Opening Analysis & Recommendations
- Identify openings played as both White and Black (ECO code, name, W/D/L stats)
- Classify playing style: aggressive / defensive / positional / tactical
- Detect pawn structures that emerge at end of opening phase
- Show style evolution trend description over time
- Recommend openings that match the player's style (style match) or fill repertoire gaps (repertoire gap)
- Each recommendation includes ECO, sample move line, and plain-language reason

### Tactical & Positional Miss Detection
- Stockfish evaluation gap (≥ 1.5 pawns) as primary signal for critical moments
- Move classification: brilliant / best / good / inaccuracy / mistake / blunder
- Aggregate into common recurring positional patterns (not every blunder individually)
- Show pattern frequency: common / occasional / rare

### Per-Game Review (added beyond v1 scope)
- Full board replay with FEN-based position rendering
- Eval bar (vertical, white/black split)
- Eval graph (clickable — click any point to jump to that move)
- Move list with classification symbols (!! ?! ? ??)
- Best-move arrows shown in blue when player played a mistake/blunder
- Last-move squares highlighted in gold
- Board coordinate labels
- Keyboard navigation: ← → ↑ ↓
- Flip board toggle
- Claude narrative summary per game

### Accuracy Tracking
- Per-game accuracy calculated from Stockfish win-probability evaluation
- Displayed per game in the Dashboard game table
- Accuracy trend chart over time: **not yet built** (planned for next phase)
- Time control filtering available via Dashboard filter bar

---

## Scope

### Built (v1 + v2)
- Chess.com game import
- Stockfish move-by-move evaluation
- Move classification (6 categories)
- Opening repertoire identification
- Playing style detection (4 types)
- Pawn structure pattern analysis
- Tactical miss pattern detection
- Opening recommendations with sample lines
- Style evolution over time
- Per-game accuracy (Stockfish win-probability formula)
- Full move-by-move Game Review page
- Platform / result / type / date filters
- JWT auth (email/password)
- Dark navy UI (Stripe-inspired design system)

### Out of Scope — Not Yet Built
- Accuracy trend chart over time
- Google OAuth backend
- Mobile responsiveness
- Endgame analysis
- Opponent rating weighting
- Time-on-clock tracking
- Multiplayer / social features
- Mobile app
- Strategic middlegame analysis
- Opening explorer

---

## Edge Cases & Handling

| Scenario | Handling |
|----------|----------|
| No games found on platform | Redirect with disclaimer |
| Fewer than 100 games | Proceed with inline warning banner |
| Corrupted / unreadable game | Silently skipped |
| Style changes drastically over time | Style evolution shown as trend, not single label |
| Stockfish analysis fails for a game | Status set to "failed" — user can retry |
| Portfolio analysis API error | Clean error message extracted from raw API response — shown with Retry button |
| Very narrow opening repertoire | Still shows recommendations — core use case, not an error |
| Games against much stronger/weaker opponents | Treated equally — no rating-based weighting in v1 |
| Mostly drawn games | Analysed same as wins/losses |

---

## Key Performance Indicators

| Metric | Target |
|--------|--------|
| Min recommended games | 100 (for reliable pattern detection) |
| Opening recommendations per session | 3+ |
| Time control filters | 5 categories (bullet / blitz / rapid / classical / chess960) |
| Analysis load time | < 60s for 100 games |
| Platforms supported | 1 (Chess.com) |
| Retention signal | DAU tracked weekly |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + SQLite (SQLAlchemy) |
| Auth | JWT (access + refresh tokens), SHA-256 pre-hash → bcrypt 3.2.2 |
| Analysis engine | Stockfish (CLI, via subprocess) |
| Chess parsing | python-chess |
| AI narrative | Anthropic Claude API |
| Frontend | React 18 + Vite + TypeScript |
| State management | Zustand (`authStore`, `gameStore`, `filterStore`) |
| HTTP client | Axios (with token-refresh interceptor) |
| Chess rendering | react-chessboard + chess.js |
| Charts | Recharts |
| Styling | CSS custom properties + inline styles (no Tailwind) |
| Font | Cabinet Grotesk (Google Fonts) |
| Tests | Vitest + jsdom (17 passing utility tests) |

### Design Palette
| Token | Value | Usage |
|-------|-------|-------|
| `--navy` | `#0D1B2A` | Page background |
| `--navy-card` | `#132840` | Card background |
| `--navy-raised` | `#1A2E45` | Hover states, panel headers |
| `--blue` | `#2563EB` | Primary CTA, active states, eval graph |
| `--gold` | `#D4A843` | Logo + primary CTA buttons only |
| `--text` | `#F5F0E8` | Primary text |
| `--text-muted` | `#8FA3B8` | Secondary text |
| `--text-dim` | `#4D6A82` | Labels, coordinates |

---

## Backlog (Prioritised)

| Priority | Item |
|----------|------|
| 🔴 High | Wire up Google OAuth backend callback |
| 🟡 Medium | Accuracy trend chart over time (originally in MVP scope — not yet built) |
| 🟡 Medium | Mobile responsiveness |
| 🟡 Medium | User onboarding flow (guided empty state → import → analyse) |
| 🟢 Low | Hover / micro-animations |
| 🟢 Low | Home page redesign (marketing landing page) |
| 🟢 Low | In-app or email notification when analysis completes |
| 🟢 Low | Rate limiting on import endpoints |
| 🔵 Future | Opening explorer |
| 🔵 Future | Game comparison |
| 🔵 Future | Social sharing |
| 🔵 Future | Deployment / hosting |
