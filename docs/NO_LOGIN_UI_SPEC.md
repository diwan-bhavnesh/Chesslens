# No-Login UI Spec

**Status:** Approved, not yet implemented · **Owner:** Bhavnesh · **Session:** guest-mode follow-up

_Companion to the already-shipped `GUEST_MODE_ENABLED` / `VITE_GUEST_MODE` toggle (commits `7cb90f2`, plus the unlanded `useAuth()` double-bootstrap fix). This spec covers the UI layer on top of that toggle — it does not change the toggle's backend mechanism._

---

## 1. Problem

The guest-mode toggle lets a visitor skip sign-up/sign-in and get a working session. But the UI built around it still talks about accounts: a "Get Started" CTA that implies creating something, a note explaining the absence of a sign-in step nobody is expecting, and a post-import "Clear & try again" button that doesn't match any real interaction pattern in the app. This spec fixes the UI layer so the product feels like what it actually is — a tool you use immediately, with no account concept visible anywhere.

## 2. Decisions (confirmed this session)

| # | Decision |
|---|---|
| 1 | Rename the Home CTA — "Analyze my games" / "Get Started" both wrongly imply the account is the user's own. New label: **"Get started"** (generic; the username field itself specifies whose profile). |
| 2 | Remove the "no sign-up, no sign-in needed" note entirely — Home hero and feature grid. No competing login path exists to explain the absence of. |
| 3 | Replace the single "Clear & try again" idea with two separate, standard actions on the Dashboard once a profile exists: **Clear All** (destructive, existing pattern, needs confirm) and **Import again** (non-destructive, new — currently missing once a profile already exists). |
| 4 | Re-import dedup logic is **already correct** — no change. `_run_import` (`backend/app/routers/games.py`) skips any game whose `external_id` is already stored for that user; new games append, nothing is overwritten or re-analyzed. |
| 5 | Backend mechanism: keep the **hidden guest account** (already built — silent `POST /auth/guest`, invisible JWT, per-browser session). No backend changes in this spec. Cross-visitor/cross-device caching by username is explicitly out of scope (see §6). |
| 6 | Navbar's "Dashboard" / "My Games" links must not appear just because a hidden guest account exists — they should appear only once this browser's guest session actually has games cached. Showing them unconditionally (today's real behavior) puts "Dashboard"/"My Games" on the landing page before a visitor has done anything, which implies an account/library that doesn't exist yet. Prototyped and confirmed: [guest-flow prototype](https://claude.ai/artifact/CYzR2XQDxjjKzMSrf5rMb1), "Nav bar: No games cached" vs. "Games cached" toggle. |

## 3. UI changes, by file

### `frontend/src/pages/Home.tsx`
- Rename button text from `Go to Dashboard` to **`Get started`** for the guest-mode branch, unconditionally — same label whether or not this browser already has a guest session with data (§8, resolved: returning-visit recognition is unreliable, not worth branching on).
- **Destination is `/import`, not `/dashboard`.** Landing a brand-new guest on `/dashboard` first meant an extra, redundant click through its empty state ("Build your Chess Profile" → "Import games") before reaching the actual username form. "Get started" now links straight to `/import`. Real accounts (`user && !user.is_guest`) keep their own "Go to Dashboard" button pointed at `/dashboard`, unchanged — they may already have a profile worth seeing immediately. A returning guest who already has data is one extra click from `/dashboard` (via the nav bar, which already shows a Dashboard link once `hasGames` is true) — an acceptable trade, consistent with not special-casing on the unreliable returning-visit signal.
- Remove the entire conditional block (lines ~86–92) that renders:
  ```
  {GUEST_MODE && (!user || user.is_guest) && (
    <p>...Trying it out — no sign-in needed...</p>
  )}
  ```
- Non-`GUEST_MODE` branch (the real "Get Started" / "Sign in" buttons, lines ~71–83) is untouched — this only matters when the toggle is off, preserving reversibility.

### `frontend/src/components/layout/Navbar.tsx`
- When `user?.is_guest` is true: render **no account chip at all** — no "Guest" label, no "Sign out" button. There is nothing to sign out of and nothing to label, so showing either invites exactly the confusion this spec is removing.
- **Dashboard/My Games links, for a guest session, only render when that session actually has games.** Today's Navbar shows them whenever `user` is truthy, which with hidden guest mode means always — even on a first-ever visit with zero games imported, which wrongly implies a library already exists. Gate them on game count instead of account existence (decision #6).
  - Implementation note: Navbar currently has no signal for "does this account have games" — it only reads `user`/`logout` from `useAuthStore`. The simplest fix without adding a new per-page fetch: call the existing `fetchGames()` (from `useGameStore`, already used by Dashboard/My Games) once, globally, right after the guest/auth bootstrap resolves — e.g. alongside `useAuth()` in `App.tsx` — so the shared game list is populated app-wide and Navbar can just check `games.length > 0`.
  - This gating applies to guest sessions only. Real accounts (`user && !user.is_guest`) keep today's unconditional Dashboard/My Games links — a real account having an established, always-visible library is correct, existing behavior and isn't part of this spec.
- When `user` is a real account (`is_guest === false`, i.e. `GUEST_MODE` off or a pre-existing real login): unchanged — email + Sign out, as today.

### `frontend/src/pages/Dashboard.tsx`
- Header fallback (`profile?.player_name ? ... : user?.email ? ... : "Chess Profile"`) leaked the raw synthetic guest email (`guest-<uuid>@...`) as the page title before any import exists, since it fell through to the `user.email` branch. Fixed: that branch now also requires `!user.is_guest`, so a guest with no import yet sees the generic "Chess Profile" title instead.
- Remove the guest banner block added in the prior session (`{user?.is_guest && (..."You're using Chesslens as a guest"...)}`) — consistent with decision #2, no account language anywhere.
- Header button row: keep **Update Profile** (rebuilds analysis from already-stored games — no change) and **Clear All** (existing delete-all + confirm modal — no change) exactly as they are today.
- Add **Import again** as a new link/button in that same row, always visible once `hasGames` is true, navigating to `/import`. This is the missing piece — today there is no way back to `/import` once a profile already exists; the only existing `/import` link is in the pre-profile empty state (line ~497).

### `frontend/src/App.tsx`
- One small addition to support decision #6: trigger `fetchGames()` (from `useGameStore`) once, after the bootstrap in `useAuth()` resolves (`!isLoading && user`), so Navbar has an app-wide game count to gate on without each page needing to fetch it separately. Everything else in this file (the `PrivateRoute` fix, route table) is unchanged.

### `frontend/src/services/api.ts`, `frontend/src/hooks/useAuth.ts`, `backend/*`
- No changes. The hidden-guest mechanism, the `useAuth()` single-bootstrap fix, and the `is_guest` computed field all stay exactly as already built — this spec is UI-copy and layout only (plus the one `App.tsx` addition above).

## 4. Behavior spec — "Import again"

1. User on `/dashboard` with an existing profile clicks **Import again**.
2. Navigates to `/import`, pre-existing filter form (unchanged).
3. On submit, hits the same `POST /games/import/{platform}` endpoint as today.
4. Backend dedup (already correct, §2 decision 4): games already stored (matched by `external_id` + `user_id` + `source`) are skipped; only new games are inserted.
5. On completion, navigates back to `/dashboard`; `Update Profile` / profile stats reflect the combined (old + newly appended) game set.
6. No "replace" behavior is introduced — this spec does not add a way to discard previously-imported games other than the existing **Clear All**.

## 5. Acceptance criteria

- [ ] Home's primary button reads "Get started" (both before and after a guest has existing data — see open question below if label should differ post-import).
- [ ] No text anywhere in the app (Home, Dashboard, Navbar) mentions "sign up," "sign in," "guest," or "account" when `GUEST_MODE` is on.
- [ ] Navbar shows nothing in the account-chip position for a guest session — no label, no button.
- [ ] Dashboard, once a profile exists, shows exactly three actions: Update Profile, Import again, Clear All.
- [ ] A brand-new guest visiting Home sees a Navbar with only the logo — no Dashboard, no My Games. After a successful import, both links appear.
- [ ] Re-running Import again with the same username does not duplicate or overwrite any existing `Game`/`GameAnalysis` row (verified by regression test, §7).
- [ ] With `GUEST_MODE_ENABLED=false` / `VITE_GUEST_MODE=false`, the app is byte-for-byte today's behavior — real "Get Started"/"Sign in" buttons, real Navbar email + Sign out. (Reversibility check, unchanged requirement from the original toggle.)

## 5a. Backlog — deferred to a later iteration, not forgotten

- **Raw backend error strings leak to the UI.** A bad or non-existent Chess.com username (e.g. a typo) currently surfaces as a raw exception string in the import form — `Client error '404 Not Found' for url 'https://api.chess.com/pub/player/.../games/archives'` — instead of a plain message like "Username not found on Chess.com." Needs backend error normalization (catch the Chess.com 404 specifically in `chesscom.py` / `_run_import`, return a clean `job.error`) plus the frontend displaying that cleanly. Deferred — revisit in the next iteration.
- **0-games-imported messaging** (raised earlier this session): a successful import that matches zero games currently looks identical to nothing happening. Needs explicit "No games matched your filters" messaging. Deferred alongside the error-handling item above, since both are "import result communication" and worth doing together.

## 6. Non-goals (explicitly deferred, not forgotten)

- Cross-visitor or cross-device caching by Chess.com username. Each browser's hidden guest session is isolated; two people analyzing the same username each trigger their own fetch. Revisit only if repeat-lookup cost/time becomes a real problem.
- Any guest-to-real-account data migration. Not applicable now that there's no visible sign-in path at all — moot unless the product direction changes again.

## 7. Verification

1. `cd frontend && npm run build` — zero new TS errors.
2. `cd backend && python3 regression_test.py` — existing suite must still pass; no backend files touched by this spec, so no new backend test sections are required.
3. Manual click-through with `GUEST_MODE_ENABLED=true` / `VITE_GUEST_MODE=true`: Home → Import → Dashboard → Import again (same username) → confirm game count is unchanged (dedup held) → Clear All → confirm empty state returns.
4. Manual click-through with both flags `false`: confirm Home/Navbar/Dashboard are visually and behaviorally identical to the pre-guest-mode app.

## 8. Resolved: Home CTA label for returning visits

Decided: "Get started" always, no second label. Reasoning (confirmed this session): the system can only recognize a returning guest via the `access_token` already sitting in that specific browser's `localStorage` — there is no other identity signal, and no cross-device/cross-browser recognition at all (see §6 non-goals). Since that signal is unreliable as a basis for changing the CTA's meaning, keep one label for both cases. A repeat lookup of the same username is already handled correctly by the existing dedup logic (§2 decision 4) — no extra UI state needed for "you've done this before."
