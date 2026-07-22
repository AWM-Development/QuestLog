# T-025 — Routine-agent dev-only guardrails and a clean production start

**Outcome:** shipped
**Branch:** feat/m-mcp/t-025-executor-dev-only-guardrails-prod-clean-start
**Diff:** 8 files changed, +118/-5 lines

## What shipped

Item 1 of scope (routine/automated agents can only ever reach dev, never prod) is done: added `assertLocalDatabaseUrl()` (`apps/server/src/db/test-db-url.ts`), wired into the two automated entrypoints that mutate the test database on every run — `test-helpers.ts`'s `createTestDb()` and `global-setup.ts`'s table-truncating `setup()`. It throws a password-redacted error unless `DATABASE_URL` resolves to `localhost`/`127.0.0.1`. Also confirmed and documented (`Docs/IMPLEMENTATION_NOTES.md` § T-025) that no real Neon/Fly credential exists in any automated path in this repo today — the strongest guarantee ("no credential, no accidental use") already holds by construction, not just by this new runtime check. Item 2 (verify prod starts clean) was **not** completed: no real Neon prod database has been provisioned yet (`Docs/DEPLOY_SETUP_CHECKLIST.md` §1 is entirely unchecked), so there is nothing to query — documented as an unmet infrastructure precondition, not fabricated or silently skipped.

## Test evidence

```
$ pnpm lint
 Tasks:    4 successful, 4 total
Cached:    4 cached, 4 total
  Time:    53ms >>> FULL TURBO

$ pnpm typecheck
 Tasks:    4 successful, 4 total
Cached:    4 cached, 4 total
  Time:    48ms >>> FULL TURBO

$ pnpm test
@questlog/mcp:test:     Test Files  1 passed (1)  / Tests  22 passed (22)
@questlog/server:test:  ✓ src/db/global-setup.test.ts (4 tests)
@questlog/server:test:  ✓ src/db/test-db-url.test.ts (6 tests)
@questlog/server:test:  ✓ src/db/test-helpers.test.ts (1 test)
@questlog/server:test:  Test Files  32 passed (32) / Tests  253 passed (253)
@questlog/web:test:     Test Files  46 passed (46) / Tests  262 passed (262)
 Tasks:    3 successful, 3 total
```

(`questlog_test_mcp`, required since T-026, had never been provisioned in this sandbox — a pre-existing gap unrelated to this diff, same one T-024's report already flagged. Provisioned and migrated it to get a real baseline.)

Direct proof the guard actually fires (not just unit-tested in isolation): before the guard existed, pointing `DATABASE_URL` at a fake Neon-shaped host during `global-setup.ts`'s `setup()` caused a real outbound connection attempt that hung until Vitest's 5s timeout. After the fix, the same input fails fast with `Refusing to connect to non-local database host "ep-cool-glade-12345.us-east-2.aws.neon.tech" — ...`.

## Exit condition check

- **All tests green, typecheck clean, lint clean — pasted output.** ✅, above.
- **Documented, auditable answer to "does the nightly executor's runtime environment have prod credentials in scope."** ✅ — `Docs/IMPLEMENTATION_NOTES.md` § T-025 cites `.gitignore:12` (`.env` never committed), `.claude/hooks/session-start.sh:33-36` (falls back to `.env.example`'s local placeholder when no `.env` exists), and both CI workflow files (`DATABASE_URL` hardcoded to a local service container, no `secrets.*` reference to a database credential anywhere). Reviewer independently re-verified each citation.
- **If a runtime guard was added: a test demonstrating it refuses a prod-shaped connection string and passes a dev-shaped one.** ✅ — `test-db-url.test.ts` tests the guard directly (Neon-shaped host rejected, `localhost`/`127.0.0.1` accepted, password never leaked in the error); `test-helpers.test.ts` and `global-setup.test.ts` prove the wiring by stubbing `DATABASE_URL` and calling the real `createTestDb()`/`setup()` functions, not just the guard in isolation.
- **A direct query against the provisioned prod database showing zero rows.** ❌ Not done — no prod database has been provisioned yet (`Docs/DEPLOY_SETUP_CHECKLIST.md` §1 entirely unchecked). This session's own environment was checked directly (no `.env`, no `NEON_*`/`FLY_*`/`DATABASE_URL` anywhere) to confirm there's no back-channel this execution missed. Not a code defect — a genuinely absent precondition. See "Anything Alex must decide" below.
- **Any real gap found has a corresponding fix in this ticket's diff.** ✅ for item 1 (no gap found beyond the new defense-in-depth guard itself, which was added anyway per the ticket's own "add it too" instruction). Item 2 found no gap to fix because there is no live database to have a gap in.

## Reviewer verdict

**PASS-WITH-NOTES**, verbatim (from the `reviewer` subagent, run against `git diff develop feat/m-mcp/t-025-executor-dev-only-guardrails-prod-clean-start`, independently re-running lint/typecheck/test and re-checking every cited file/line rather than trusting the ticket narrative):

> This all matches the diff. No scope creep found — every changed file is directly tied to item 1's guard implementation and documentation.
>
> **Item 1 (executor can't reach prod credentials) — correctly implemented:**
> - `apps/server/src/db/test-db-url.ts:17-33` — `assertLocalDatabaseUrl()` is well-scoped: hostname allowlist of `localhost`/`127.0.0.1`, password never appears in the thrown error (confirmed by reading the implementation, not just the test name).
> - Correctly wired into `apps/server/src/db/test-helpers.ts:48` and `apps/server/src/db/global-setup.ts:53` — the two entrypoints that mutate the test DB.
> - Correctly *not* applied to `apps/server/src/db/index.ts` or `apps/server/src/db/migrate.ts` (verified by grep — neither imports `assertLocalDatabaseUrl`), which legitimately need prod access.
> - Confirmed `apps/mcp`'s `vitest.config.ts:28`/`vitest.e2e.config.ts:28` reuse `apps/server/src/db/global-setup.ts` for their own `globalSetup`, so mcp's test runs inherit the same guard — no missed entrypoint.
> - Tests are real, not theater: stub `DATABASE_URL` via `vi.stubEnv` and call the actual `setup()`/`createTestDb()` functions, not just the guard in isolation.
> - Every factual claim in the IMPLEMENTATION_NOTES.md T-025 section checked out against the real files.
>
> **Minor nit:** `Docs/IMPLEMENTATION_NOTES.md` cites `.gitignore:2` for the `.env` ignore rule; the actual line is `.gitignore:12`. The underlying claim is still true — just a wrong line reference.
>
> **Item 2 (prod clean-start) — honestly reported as not completed, not fabricated:**
> - `Docs/DEPLOY_SETUP_CHECKLIST.md:9-13` (§1, Neon) is entirely unchecked. There is genuinely nothing to query.
> - This is consistent with the ticket's own "Definition of done" section, which explicitly anticipates M-MCP.5's overall checkbox not flipping until "Alex confirms prod is live." Provisioning a Neon project/payment method is not something an autonomous agent can do — this doesn't fit the Blocked Protocol's "3 approaches on the same failure" framing either, since there's no failing approach, just a genuinely absent precondition.
>
> **No scope creep.** **Pattern conformance:** no schema changes, so the migration-journal rule doesn't apply. The new tests' `vi.stubEnv` usage sits adjacent to but isn't actually covered by `.claude/rules/backend.md`'s "never patch `process.env`" rule (that rule's context is specifically Voyage/Anthropic HTTP mocking, not DB connection-string resolution) — worth a human glance but not a rule violation in spirit.
>
> PASS-WITH-NOTES

**Remediation applied:** the `.gitignore` line citation was fixed (`.gitignore:2` → `.gitignore:12`) — commit `fix(T-025): correct .gitignore line citation in IMPLEMENTATION_NOTES`.

## Anything Alex must decide

- **Item 2 of scope (verify prod starts clean) is not done and cannot be done from this session** — no real Neon prod database has been provisioned yet (`Docs/DEPLOY_SETUP_CHECKLIST.md` §1 is entirely unchecked; §2's Fly secrets/first-deploy are also still deferred per T-024's addendum). Once you complete §1-§2 of the checklist, this specific check is a single `psql`/Neon-console query away, not new engineering work — worth re-running this ticket's exit condition manually (or via a small follow-up ticket) at that point.
- Per the ticket's own Definition of Done, `MILESTONES_V1_MCP.md`'s M-MCP.5 checkbox is **not** flipped (not applicable until this, T-023, and T-024 are all done and you confirm prod is live).
- The "prod-shaped vs. dev-shaped" language in the ticket's own exit condition turned out to be a false distinction once your actual infra choice (Neon for both dev and prod) was known — both branches share the `*.neon.tech` hostname pattern, so the guard's real boundary is "local Postgres" vs. "any hosted database," which is also the more useful boundary for this ticket's actual concern (the executor must never touch *any* real Neon branch, dev or prod). Flagging in case this reads as a deviation from the literal ticket wording rather than a reasoned adjustment.
