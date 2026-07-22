# T-027 — Audit and rationalize test-DB infrastructure sprawl

**Outcome:** shipped
**Branch:** feat/m-mcp/t-027-test-infra-sprawl-cleanup
**Diff:** 13 files changed, +112/-19 lines

## What shipped

`apps/mcp`'s real-API e2e suite now runs against its own `questlog_test_mcp` database instead of sharing `apps/server`'s `questlog_test` — the same concurrent-suite race T-026 fixed for the default test tier, still live in the e2e tier until now. The hand-typed `postgresql://questlog:questlog@localhost:5433/<dbname>` connection-string literal (previously duplicated across 7 TypeScript files) is now built from one shared `apps/server/src/db/test-db-url.ts`. The test isolation model and the intentional `apps/mcp` → `apps/server` `globalSetup` cross-app import are now documented as deliberate design in `IMPLEMENTATION_NOTES.md` and inline comments, not unaddressed debt.

## Test evidence

Lint (`pnpm lint`):

```
@questlog/shared:lint: Checked 13 files in 183ms. No fixes applied.
@questlog/mcp:lint: Checked 19 files in 67ms. No fixes applied.
@questlog/server:lint: Checked 75 files in 72ms. No fixes applied.
@questlog/web:lint: Checked 158 files in 210ms. No fixes applied.

 Tasks:    4 successful, 4 total
```

Typecheck (`pnpm typecheck`):

```
@questlog/shared:typecheck: > tsc --noEmit
@questlog/server:typecheck: > tsc -b
@questlog/mcp:typecheck: > tsc -b
@questlog/web:typecheck: > tsc -b

 Tasks:    4 successful, 4 total
```

Test — forced (non-cached) full run (`pnpm turbo test --force`):

```
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  22 passed (22)
@questlog/server:test:  ✓ src/db/test-db-url.test.ts (2 tests) 3ms
@questlog/server:test:  Test Files  31 passed (31)
@questlog/server:test:       Tests  247 passed (247)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)

 Tasks:    3 successful, 3 total
```

Pre-ticket baseline (clean `develop` checkout, before any change in this ticket):

```
mcp:     Test Files  1 passed (1)   |  Tests  22 passed (22)
server:  Test Files 30 passed (30)  |  Tests 245 passed (245)
web:     Test Files 46 passed (46)  |  Tests 262 passed (262)
```

Side by side: mcp and web are byte-identical (22/1, 262/46). server gained exactly one file / two tests — `src/db/test-db-url.test.ts`, the TDD unit test for the new `testDbUrl()` helper this ticket introduces (per CLAUDE.md's "TDD, no exceptions," which overrides a literal reading of "test count unchanged" — see "Anything Alex must decide" below). No existing test's assertions changed anywhere in the diff.

e2e tier (`pnpm turbo test:e2e --force`) — `VOYAGE_API_KEY`/`ANTHROPIC_API_KEY` unavailable in this sandbox, same precedent as T-026:

```
@questlog/server:test:e2e:  ↓ src/services/search.e2e.test.ts (1 test | 1 skipped)
@questlog/mcp:test:e2e:  ↓ src/query-lore.e2e.test.ts (1 test | 1 skipped)

 Tasks:    2 successful, 2 total
```

Both configs load and resolve without error (proving the config diff itself is syntactically and structurally sound); the `describe.skipIf(!process.env.VOYAGE_API_KEY)` guard skips cleanly rather than failing. `testDbUrl("questlog_test_mcp")` is separately unit-tested (`test-db-url.test.ts`) to produce the exact literal `apps/mcp/vitest.e2e.config.ts` now uses, so the repointing itself is proven correct even without a live concurrent e2e run.

## Exit condition check

- **All tests green, typecheck clean, lint clean** — pasted above.
- **Test count unchanged** — pre/post counts pasted above side by side; the only delta is the new TDD unit test for this ticket's own new code (see caveat above and "Anything Alex must decide").
- **`grep -rn "postgresql://questlog:questlog@localhost:5433" apps/ --include="*.ts"` returns matches only inside the new shared module** — verified: only hits are in `test-db-url.ts` (the module itself) and `test-db-url.test.ts` (its unit test, which necessarily contains the literal it's asserting against).
- **`apps/mcp/vitest.e2e.config.ts`'s `DATABASE_URL` no longer equals `apps/server`'s; `e2e-release-check.yml` provisions/migrates `questlog_test_mcp`** — confirmed by inspection and the config/workflow diff; a forced live concurrent e2e run could not be executed for real (no `VOYAGE_API_KEY`/`ANTHROPIC_API_KEY` in this sandbox) — same documented fallback T-026 used.
- **`Docs/IMPLEMENTATION_NOTES.md` contains the new isolation-model note** — new `## T-027` section added, existing T-018/T-023 entries untouched.
- **Both `apps/mcp` vitest configs' `globalSetup` lines have the explanatory comment** — present in both `vitest.config.ts` and `vitest.e2e.config.ts`.

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim:

> No functionality gaps against the five Scope items, no real scope creep, no test theater, and both edge-case deviations are defensible engineering judgment calls that are transparently documented in the diff itself.
>
> Findings worth a human glance:
> - `.claude/hooks/session-start.sh` (not edited) — item 3 is 2/3 complete; low risk, sandbox-blocked, disclosed at `Docs/IMPLEMENTATION_NOTES.md:63`.
> - `apps/server/src/db/test-db-url.test.ts:1-16` — new test file causes the exit condition's literal grep to also match a test file, not only the shared module; cosmetic mismatch against the exit condition's exact wording, not a substantive issue.

No remediation pass was needed (PASS-WITH-NOTES, not FAIL).

## Anything Alex must decide

- **`.claude/hooks/session-start.sh`'s cross-referencing comment (Scope item 3) was not added** — this file's edit was rejected twice by this sandbox's tool-permission layer specifically for this path (not a design choice; `ci.yml` and `e2e-release-check.yml` both got their comments without issue). 2 of the 3 sites are cross-referenced; `session-start.sh`'s own comment (already naming T-026) was left as-is. Low risk — comment-only, zero functional impact — but someone should add the third cross-reference by hand, or re-run this ticket's session-start.sh edit in an unrestricted environment.
- **`apps/server/drizzle.config.ts` was modified even though it wasn't in the ticket's named `Context files:` list or its "~6 locations" enumeration** — it hand-typed the same literal, and the ticket's own exit-condition grep is repo-wide, so leaving it untouched would have failed the ticket's own machine-checkable bar. Judged necessary, not scope creep; reviewer agreed.
- **A new unit test (`test-db-url.test.ts`, 2 tests) was added for the new `testDbUrl()` helper**, which literally changes the "test count unchanged" pre/post numbers this ticket's exit condition asks to show matching. CLAUDE.md's "TDD, no exceptions" is unconditional project-wide, and `testDbUrl` is genuinely new logic introduced by this ticket — reviewer agreed this was the right call over a literal reading of the exit condition, and the delta is disclosed rather than hidden.
- **`questlog_test_mcp` had to be manually provisioned in this sandbox before any test could run** — the session-start hook that normally provisions it ran on a stale pre-checkout snapshot before this session switched to `develop` (which already has T-026's three-database list). Not a ticket defect; noted here in case a future run in a similarly stale sandbox hits the same missing-database error.
