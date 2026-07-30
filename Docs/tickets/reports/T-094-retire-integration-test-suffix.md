# T-094 — Retire the `.integration.test.ts` naming tier

**Outcome:** shipped
**Branch:** gates/g-009-integration-test-suffix-retire-or-enforce
**Diff:** 13 files renamed, 7 docs/comments/tickets updated

## What shipped

Renamed all 13 `*.integration.test.ts` files to plain `*.test.ts` — 9 under `apps/server/src` (routers + routes), 4 under `packages/core/src/db/schema`. Every vitest config already ran default-tier tests (both suffixes) identically, splitting out only `*.e2e.test.ts`; the suffix signaled nothing a config or contributor could rely on.

Updated the three living convention docs (`.claude/rules/backend.md`, `.claude/skills/tdd-loop/SKILL.md`, `Docs/DEVELOPMENT_GUIDE.md`) to state plainly that unit and integration tests share one `*.test.ts` suffix and the only real split is `*.e2e.test.ts`. Fixed the durable file-locator header in `Docs/IMPLEMENTATION_NOTES.md`'s T-032 section, two source comments referencing old filenames (`smoke-test-dev.ts`, `search.e2e.test.ts`), and two not-yet-executed tickets whose Context files named old filenames (`T-091` in `backlog/`, `T-064` in `queue/`) so a future executor run doesn't hit a missing file.

Left purely historical narrative in `IMPLEMENTATION_NOTES.md` untouched (past-tense incident descriptions naming old filenames) — those describe what happened at the time, not current-state guidance.

## Test evidence

```
$ pnpm typecheck
 Tasks:    6 successful, 6 total
Cached:    4 cached, 6 total
  Time:    2.629s

$ pnpm lint
 Tasks:    6 successful, 6 total
Cached:    4 cached, 6 total
  Time:    1.068s

$ pnpm build
 Tasks:    3 successful, 3 total
Cached:    0 cached, 3 total
  Time:    6.514s

$ pnpm test
@questlog/web:test:  Test Files  46 passed (46) — Tests  262 passed (262)
@questlog/mcp:test:  Test Files  1 passed (1) — Tests  39 passed (39)
@questlog/core:test:  Test Files  27 passed (27) — Tests  239 passed (239)
@questlog/server:test:  Test Files  14 passed (14) — Tests  103 passed (103)
 Tasks:    5 successful, 5 total
Cached:    3 cached, 5 total
  Time:    5.263s
```

One `pnpm test` run mid-session hit two different single-test failures (`global-setup.test.ts`, then `context.service.test.ts` on a re-run) — both reproduced as passing in isolation immediately after, and both traced to this worktree's `docker compose up -d` failing to bind `:5433` (already allocated by another concurrently-running worktree) and falling back to sharing that worktree's Postgres instance. Not a regression from this ticket's renames; the clean run above is from a subsequent full-suite pass with no interleaved failures.

## Exit condition check

- **All tests/typecheck/lint/build green, pasted output** — see above.
- **`find . -name "*.integration.test.ts"` returns nothing** — confirmed empty.
- **`grep -rn "integration\.test\.ts"` across non-historical files returns only intentional explanatory lines** — confirmed: the only remaining hits are the three "there is no `.integration.test.ts` suffix" explanatory sentences added to `backend.md`/`tdd-loop/SKILL.md`/`DEVELOPMENT_GUIDE.md`, plus one deliberately-untouched historical narrative line in `IMPLEMENTATION_NOTES.md` (see Out of scope).

## Anything Alex must decide

None. This ticket, its gate (G-009), and the implementation all landed in one interactive `/ungate` session at Alex's direction, skipping the normal backlog/queue routing per explicit instruction — no autonomous judgment calls to flag.
