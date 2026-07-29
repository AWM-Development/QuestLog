# T-036 — Post-merge smoke-test workflow against real dev infrastructure

**Outcome:** shipped
**Branch:** feat/m-cicd/t-036-post-merge-smoke-test-dev
**Diff:** 4 files changed, +207/-1 lines (`.github/workflows/smoke-test-dev.yml`, `apps/server/package.json`, `apps/server/scripts/smoke-test-dev.ts`, `pnpm-lock.yaml`)

## What shipped

A new GitHub Actions workflow (`.github/workflows/smoke-test-dev.yml`), triggered on push to `develop` and via `workflow_dispatch`, that polls `questlog-dev`'s `/health` endpoint until the deploy is live, then runs a new verification script (`apps/server/scripts/smoke-test-dev.ts`, invoked via a new `smoke:dev` package.json script) that exercises the real deployed environment end to end: a real `campaign.create` -> `campaign.list` round trip through the live tRPC API, then a direct Postgres connection (bypassing the app) confirming the schema has all 13 expected tables and the `vector`/`pg_trgm` extensions are present, then a scoped cleanup delete of the throwaway campaign via direct SQL. Entirely separate from `ci.yml`'s PR-gate suite. The `DEV_DATABASE_URL` GitHub secret this needs is Alex-only to provision (not attempted here) — checklist below.

## Test evidence

```
$ DATABASE_URL=postgresql://questlog:questlog@localhost:5433/questlog_test bash scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (626 passed)
```

`actionlint` against the new workflow file:
```
$ ./actionlint -color .github/workflows/smoke-test-dev.yml
$ echo $?
0
```

Full local run of the verification script against a locally-booted `apps/server` instance + local Postgres (the "realistic local Postgres" run the exit condition asks for), using the exact command the workflow now runs (`pnpm --filter @questlog/server smoke:dev <url>`):

```
$ DATABASE_URL=postgresql://questlog:questlog@localhost:5433/questlog DEV_BASE_URL=http://localhost:3099 \
  pnpm --filter @questlog/server smoke:dev "$DEV_BASE_URL"

> @questlog/server@0.0.0 smoke:dev /home/user/QuestLog/apps/server
> tsx scripts/smoke-test-dev.ts http://localhost:3099

Smoke-testing http://localhost:3099
  /health OK
  campaign.create OK (73185f0c-588e-4696-817d-7ea81345afa5)
  campaign.list OK
  schema OK (13 expected tables present)
  extensions OK (vector, pg_trgm)
  cleaned up campaign 73185f0c-588e-4696-817d-7ea81345afa5
PASS — /health -> campaign.create -> campaign.list -> schema -> extensions -> cleanup succeeded against http://localhost:3099.
$ echo $?
0
```

Failure-path demonstration (temporarily added a nonexistent table to `EXPECTED_TABLES`, ran the script, confirmed non-zero exit and that cleanup still ran, then reverted the change — verified `git diff` was clean before committing):

```
$ DATABASE_URL=postgresql://questlog:questlog@localhost:5433/questlog \
  pnpm exec tsx scripts/smoke-test-dev.ts http://localhost:3099

Smoke-testing http://localhost:3099
  /health OK
  campaign.create OK (b3371db6-9e56-44b2-a7a9-4cb25c24ac57)
  campaign.list OK
  cleaned up campaign b3371db6-9e56-44b2-a7a9-4cb25c24ac57
FAIL — Error: Missing expected table(s): definitely_missing_table
    at main (/home/user/QuestLog/apps/server/scripts/smoke-test-dev.ts:95:10)
$ echo $?
1
```

## Exit condition check

- **All tests green, typecheck clean, lint clean — pasted output.** ✅ above.
- **The new workflow YAML is valid.** ✅ — `actionlint` exits 0 (above); GitHub Actions itself will also lint it on push.
- **The verification script, run locally against a real/realistic local Postgres, completes the full create -> verify-schema -> verify-extensions -> delete sequence — paste the output.** ✅ above, run against a locally-booted `apps/server` + local Postgres (`questlog` on `:5433`), using the actual workflow invocation.
- **The workflow correctly fails (non-zero exit) when a step fails — demonstrated locally, not via a real workflow run without the secret in place.** ✅ above.

## Reviewer verdict

First pass: **FAIL**, verbatim key finding (from the `reviewer` subagent, run against `git diff develop feat/m-cicd/t-036-post-merge-smoke-test-dev`):

> **Blocking finding (FAIL)** — `.github/workflows/smoke-test-dev.yml:65` — the workflow's only substantive step is broken and will fail on every run, regardless of whether the actual smoke-test assertions would pass: `run: pnpm exec tsx apps/server/scripts/smoke-test-dev.ts "$DEV_BASE_URL"`. `tsx` is a devDependency scoped to `apps/server/package.json`, not the workspace root — running `pnpm exec tsx ...` from the repo root (the default working directory for every step, no `working-directory:` override) fails immediately with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "tsx" not found`, reproduced locally with the exact pinned pnpm version. The existing `smoke:mcp-remote` precedent (invoked via `pnpm --filter @questlog/server smoke:mcp-remote`) shows the pattern this diff should have followed but didn't.
>
> Everything else checked clean: `EXPECTED_TABLES` matches the schema exactly; cleanup delete correctly scoped and wrapped in `try/finally`; `@trpc/client` usage correctly mirrors `apps/web/src/lib/trpc.ts`; trigger config matches Scope exactly; `DEV_DATABASE_URL` scoped to one step's `env:`; no out-of-scope violations; absence of a `.test.ts` file for the script is consistent with the `verify-mcp-remote.ts`/`mcp-remote-smoke.ts` precedent.

**Remediation applied** (one pass, per the routine): added a `smoke:dev` script to `apps/server/package.json` and changed the workflow's `run:` line to `pnpm --filter @questlog/server smoke:dev "$DEV_BASE_URL"`. Verified the fix by running that exact command from the repo root against a local server/DB (passed — see Test evidence above); also confirmed in the process that the `pnpm --filter <pkg> run <script> -- <args>` form mis-forwards a literal `--` into `argv[2]` under this repo's pinned pnpm (9.15.5), so the shipped form omits `run`/`--` entirely. Re-ran lint/typecheck/test after the fix — all green (above). Not re-submitted to the reviewer subagent a second time; per `EXECUTOR_ROUTINE.md` Step 5, one remediation pass is the last attempt regardless of outcome, and this fix was verified directly against the reviewer's own exact repro command.

## Anything Alex must decide

- **No `Docs/tickets/cost-reports/T-036.usage.json` was produced this run** — `pnpm --filter @questlog/server run capture-usage` (invoked with empty stdin, per Step 7) reported "no stdin payload and no session found via CLAUDE_CODE_SESSION_ID — skipping usage capture" and exited 0. Root-caused, not just observed: `resolveHookPayloadFromEnv` (`packages/core/src/observability/capture-usage.ts:97`) does `join(claudeHomeDir, "projects")` on the `homedir()` value it's passed (e.g. `/root`), landing on `/root/projects` — but the real transcript lives at `/root/.claude/projects/<project>/<sessionId>.jsonl` (confirmed present, correct session id). The join is missing a `.claude` path segment; verified by reproducing both paths directly. This is a pre-existing bug in T-035's follow-up fallback path, unrelated to T-036's scope (the smoke-test workflow) — not fixed here to avoid scope creep, but it silently no-ops usage capture for this session and likely any other session where `tmp/.session-context.json` doesn't survive to Step 7. Worth a follow-up ticket; flagging rather than fixing unilaterally.
- **`DEV_DATABASE_URL` GitHub Actions secret still needs to be added** (repo Settings → Secrets and variables → Actions) — the same dev Neon connection string already set as `questlog-dev`'s Fly `DATABASE_URL` secret. No agent has access to GitHub repo settings' secrets UI; not attempted here, per the ticket's own explicit instruction.
- Once that secret exists, confirm a real workflow run succeeds — either wait for a `develop` push (once T-035's Fly dashboard connection is also live) or trigger it manually via `workflow_dispatch` from the Actions tab. Only then does M-CICD.2's milestone checkbox flip, per this ticket's own Definition of Done — left unchecked in `Docs/milestones/MILESTONES_V1_1_MCP.md` for now.
- No 🧠 strategy gates encountered in this ticket's scope.
