# T-059 — Observability store: comment schema + write endpoint

**Outcome:** shipped
**Branch:** feat/m-obs/t-059-observability-comment-schema-endpoint
**Diff:** 23 files changed, +770/-11 lines
**Complexity tier:** M
**Strategy-gate flag:** no

## What shipped

A new `ticket_comments` table in `packages/observability` and a `comment` tRPC router (`comment.list`, `comment.add`) exposing append-only, per-ticket comment threads — the backend T-058's future Log-view comment UI will write to. `author` is hardcoded `"alex"` server-side for v1; agent-authored comments stay deferred per Alex's 2026-07-26 decision. No UI consumes this yet.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (873 passed)
```
(Ran 3 consecutive full-suite passes after the cross-package race fix below — all green.)

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see Test evidence above.
- **Migration applies cleanly against a fresh local Postgres db alongside T-053's existing tables** — ran `pnpm --filter @questlog/observability db:migrate` against both the local dev DB (`questlog_observability`, already carrying T-053's `ticket_runs`/`ticket_reports`) and the local test DB (`questlog_test_observability`); both completed with `Migrations complete.` and no errors.
- **`add` followed by `list` for the same `ticket_id` returns the new comment with `author: "alex"`, correct `body`, and a server-set `created_at`** — `packages/observability/src/comment.test.ts` ("add followed by list...") and `apps/server/src/routers/comment.test.ts` ("comment.add > inserts a comment...") both assert this at the service and HTTP-router layers.
- **`list` against a `ticket_id` with no comments returns an empty array, not an error** — `packages/observability/src/comment.test.ts` ("returns an empty array...") and `apps/server/src/routers/comment.test.ts` ("comment.list > returns an empty array...").

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim:

> Deliberate deviation check (Context.observabilityDb optional + lazy dynamic import): Reasonable and well-justified. Blast radius (14 existing `buildApp` test call sites) vs. required-field is a legitimate tradeoff, `requireObservabilityDb` fails loudly rather than NPEing, and the consequence (500s until the Fly secret is set) is explicitly documented. Not a bug.
>
> Exit condition coverage: All four exit-condition items are covered by real assertions, not theater. [...]
>
> Pattern conformance: Router is thin, delegates to `packages/observability/src/comment.ts`, uses `withErrorHandling`, input validated via shared Zod schemas — matches `.claude/rules/backend.md`'s Router→Service→Drizzle shape and the existing `packages/observability` file layout.
>
> Minor notes (not blocking):
> - `apps/server/src/main.ts:4-14` — doc comment re-derives rationale already in IMPLEMENTATION_NOTES.md § T-059; should collapse to a one-line pointer.
> - `packages/observability/src/db/global-setup.ts:5` — docstring still says "Truncates both observability tables," now stale (three tables after this diff).
> - `packages/shared/src/validators/comment.ts:16-23` — `CommentSchema` exported but never wired via `.output()` — matches existing convention (no router in this codebase uses `.output()`), not a deviation.
>
> No functionality gaps, no scope creep against Out of scope, no test theater found.

Both minor notes were fixed in a follow-up commit before wrap-up (main.ts comment collapsed to a one-line pointer; global-setup.ts docstring corrected).

## Efficiency notes

Stayed close to estimate for an M-tier ticket with a genuinely new cross-package wiring decision to make (T-054, the ticket meant to establish the tRPC-router-reads-observability-DB pattern, hasn't shipped yet — this ticket had to invent that convention itself rather than follow precedent). Most of the extra time went to two things beyond the ticket's literal Scope: (1) working out that `Docs/DEPLOY_SETUP_CHECKLIST.md`'s Fly secrets list doesn't include `OBSERVABILITY_DATABASE_URL`, which meant a static import in `main.ts` would crash deployed server boot — caught by checking the actual deploy checklist rather than assuming, not by a test; (2) a genuine flaky test found live during a full-suite run (a cross-package race between `apps/server`'s new observability-DB test connection and `packages/observability`'s own suite truncating the same physical test database under `pnpm turbo test`'s default parallelism) — root-caused and fixed via a `turbo.json` package-scoped task dependency, then re-verified clean across 3 consecutive full-suite runs.

**Retry log:** 1 retry — `genuine_bug_caught_by_test`-adjacent, though not a logic bug in the ticket's own code: a flaky cross-package test race (see above), caught by the full-suite run rather than any single test, root-caused, and fixed via `turbo.json`. 0 lint/typecheck retries; 0 environment_setup retries beyond normal worktree bootstrap.

## Anything Alex must decide

- **Deploy-side follow-up, not blocking:** `OBSERVABILITY_DATABASE_URL` isn't in `Docs/DEPLOY_SETUP_CHECKLIST.md`'s Fly secrets list yet. Until it's set (`fly secrets set -c fly.dev.toml OBSERVABILITY_DATABASE_URL=<neon-branch-url>`), the deployed server logs a warning at boot and `comment.list`/`comment.add` 500 with a clear "observabilityDb not configured" error. No UI calls these endpoints yet (T-058 is pending), so nothing is broken today — just flagging it needs to happen before T-058 ships and actually needs a working backend.
- **Milestone checkbox not flipped:** `M-OBS.5` in `Docs/milestones/MILESTONES_V1_2_MCP.md` covers T-057/T-058/T-059 jointly and stays `[ ]` — T-057/T-058 haven't shipped yet, so checking it now would misstate the milestone's actual state.
- Everything else: none.
