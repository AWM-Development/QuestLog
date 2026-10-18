# T-158 — Observability dashboard: Board view

**Outcome:** shipped
**Branch:** feat/m-obs/t-158-observability-dashboard-board-view
**Diff:** 14 files changed, +1050/-3 lines (incl. docs; ~1,000 in `apps/observability-dashboard`, of which ~350 CSS and ~280 tests)
**Complexity tier:** M
**Strategy-gate flag:** yes (G-043, already resolved — mockup at `Docs/mockups/board/`)

## What shipped

A `/board` route on the observability dashboard (plus a "Board" nav link) that renders `board.list` as six fixed-width columns — Gated, Backlog, Queue, In-progress, Blocked, Done — with cards, a details modal, and plain empty/loading/error states. Read-only.

## Test evidence

`scripts/run-tests-quiet.sh` (lint → typecheck → test), run after the last code change:

```
lint: pass (0 warnings)
typecheck: pass
test: pass (1065 passed)
```

New tests: `columns.test.ts` (5) and `BoardPage.test.tsx` (7), both green.

## Exit condition check

- all tests green, typecheck clean, lint clean — output above.
- every status lands in its column, chips only where data has them — `BoardPage.test.tsx` "places each ticket in its status column…" (fixture covers gated/backlog/queue/in-progress/done; no chip row on in-progress/done cards).
- column layout aligned at multiple widths — verified structurally, as T-057's fix was: every column uses the one `BOARD_COLUMN_STYLE` constant, asserted in "gives every column the identical fixed-width style". Not verified in a real browser at multiple widths (jsdom has no layout).
- empty column renders plain empty state — "renders the plain empty state in an empty column" (Blocked).
- `board.list` error renders error state — "renders the error panel… and retry refetches".
- card click opens modal with full untruncated data; × or backdrop closes — "opens a details modal…" (full chip list incl. overflow chip, branch, scope excerpt).

## Reviewer verdict

PASS-WITH-NOTES.
1. `TicketModal.tsx:19-20` — biome-ignore comment claimed an Escape handler that doesn't exist. **Fixed** (comment now accurate; no Escape handler added, out of scope).
2. Modal shows Column but not Milestone ref — the known deviation (below).
3. Fixture has five of six statuses; Blocked is deliberately empty to exercise the empty state. Not changed.
4. New CSS uses hard-coded `rgba()` status tints, same as existing `index.css` precedent. Not changed.
5. `BOARD_COLUMN_STYLE` doc comment slightly long but carries a durable WHY. Not changed.

## Efficiency notes

- Early shell-chain slip: a BSD `sed` call failed mid-`&&` chain, so the claim push went out before the promotion/pickup commits; redone and pushed correctly right after. No code impact.
- The per-worktree Postgres (:5581) wasn't running when the first full gate ran (mcp tests ECONNREFUSED); re-ran `session-db-local.sh`.

**Retry log:** 2 retries: 1 environment_setup (worktree Postgres not up), 1 mechanical_lint_typecheck (Biome a11y rules — card → `<button>`, modal → `<dialog open>`). 0 genuine_bug_caught_by_test.

## Anything Alex must decide

- **Milestone ref missing from the modal.** The ticket and mockup list it, but `TicketCard` has no such field. Omitted rather than expanding scope into `board.list`. A small follow-up (parse `Milestone ref:` in `board.service.ts` + schema) would restore it — worth a ticket, or fold into T-168.
- **M-OBS.9 checkbox left unchecked** — it spans T-157–T-169; I added a "T-158 complete" note instead, like T-157/T-165.
- Not visually verified in a browser at real widths (tests only).
