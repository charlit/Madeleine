# QA Report — Madeleine (localhost:8090 static + in-process API mock, Standard tier)
Date: 2026-09-16 · Branch: claude/madeleine-cat-grid-game-sxc694 · Mode: Full (no diff, root-level app)

## Summary
- Issues found: **0** (functional). One benign 404 noted below (browser's automatic `/favicon.ico` request — no favicon file exists yet, not something the app requests itself).
- Fixes applied: 0 (verified: 0, best-effort: 0, reverted: 0)
- Deferred: 1 (add a real favicon file)
- Health score: **10/10 → 10/10** (no regressions, nothing to fix)

> "QA found 0 functional issues, health score 10/10 → 10/10."

## Setup notes
- Working tree was clean.
- `npx netlify dev` was tried first (the correct way to serve the static site
  *and* `netlify/functions/scores.js` together) but could not start in this
  sandbox: Netlify CLI's Edge Functions bootstrap tries to download a runtime
  binary, and this environment's egress proxy blocks that host (403) —
  unrelated to the project itself, which defines no edge functions. On a
  normal machine/CI this should just work.
- Given that, two things were tested separately instead:
  1. **Front end** — served statically with `python3 -m http.server 8090`
     (no build step needed; plain HTML/CSS/JS).
  2. **API logic** (`netlify/functions/scores.js`) — the handler was imported
     directly in a small Node script and called with real `Request` objects,
     with an in-memory stand-in for `@netlify/blobs` (`getStore`/`get`/`setJSON`)
     since the real Netlify Blobs client needs a linked site + token that
     doesn't exist in this sandbox. This still exercises the actual
     validation, sorting, truncation and top-10 slicing code in `scores.js`
     unmodified — only the storage backend was swapped.
- `.claude/launch.json` was added (kept, per your PalmStreet convention) with
  `npx netlify dev` as the configured launch command — this is the one that
  will actually work end-to-end (static site + `/api/scores`) once run
  outside this sandbox's network restrictions.
- All temporary test scripts, the mock store, `node_modules`, and the
  `.netlify/` cache directory created while probing `netlify dev` were
  deleted after the run — nothing test-related was left in the tree.

## What was tested
1. **Landing screen** — title "Madeleine", "Jouer" / "Top 10" buttons, score
   starts at 0, timer starts at 45. No console errors from the app itself
   (see favicon note above).
2. **TOP 10 modal** — opens and closes correctly; with no backend reachable
   from the static server it falls back to the graceful "Classement
   indisponible pour le moment." message instead of crashing (the fetch
   failure is caught, not thrown). The true **empty-list** wording ("Aucun
   score enregistré pour l'instant. Sois le premier !") was verified via the
   API-logic test below, which confirms `GET` on an empty store returns `[]`
   and the front end's `renderLeaderboardList([])` branch renders exactly
   that string.
3. **Gameplay** — "Jouer" hides the overlay, the board renders all 48 tiles,
   random adjacent swaps reliably trigger matches, the score increments
   correctly, and cascades resolve without errors. Confirmed alongside the
   earlier fix that only changed tiles repaint (no full-board flash).
4. **Score submission** — the pseudo-field + "Enregistrer mon score" +
   status-line markup is present and wired up on the game-over screen (full
   `POST /api/scores` round-trip needs a reachable backend — see API section).
5. **Responsive/mobile** — 375×812 viewport (same size PalmStreet's report
   used) renders with no horizontal overflow and no console errors.
6. **Audio** — not applicable; Madeleine has no audio system (unlike
   PalmStreet's mute/unmute button).
7. **API validation** (direct calls to the `scores.js` handler, mocked store):
   - `GET` on empty store → `200 []` ✅
   - `POST {name, score}` valid → `200`, entry present with correct name/score ✅
   - `POST` with negative score → `400 {"error":"invalid score"}` ✅
   - `POST` with score over `MAX_SCORE` (100000) → `400 {"error":"invalid score"}` ✅
   - List stays sorted descending by score after multiple inserts ✅
   - Name longer than 14 chars gets truncated to 14 ✅
   - Missing `name` falls back to `"Anonyme"` ✅
   - List never exceeds `MAX_ENTRIES` (10) even after 10+ inserts ✅
   - `OPTIONS` preflight → `204` with CORS headers ✅
   - Unsupported method (`DELETE`) → `405` ✅
   - Malformed JSON body → `400` ✅
8. **Console/network** — no JS errors and no failed requests from anything
   the app itself triggers, across the whole session.

## Deferred
- Add a real favicon (`favicon.ico` or a `<link rel="icon">`) so the browser
  stops requesting a file that doesn't exist. Cosmetic only, zero user impact.
- Re-run the full `netlify dev` flow (static site + live `/api/scores`) once
  outside this sandbox, or after deploying to Netlify, to confirm Netlify
  Blobs itself persists correctly in production — the mocked test above
  proves the handler logic is correct, but not the real Blobs storage layer.

## Notes for next session
- `netlify dev`'s Edge Functions bootstrap is what failed here (403 on a
  binary download), not anything in this project — Madeleine defines no
  edge functions. If `/qa` or `/run` hits the same wall in a similarly
  sandboxed environment, fall back to the two-track approach above (static
  server for the UI, mocked-store unit test for `scores.js`) rather than
  assuming the app is broken.
- If `netlify dev` *does* run cleanly (normal machine, real network access),
  prefer it over the two-track approach — it exercises the real Netlify
  Blobs emulation and is the closest thing to production.
