# T-037 — Post-merge smoke-test workflow against real prod infrastructure (read-only)

**Outcome:** shipped
**Branch:** feat/m-cicd/t-037-post-merge-smoke-test-prod
**Diff:** 3 files changed, +128/-37 lines (`.github/workflows/smoke-test-prod.yml`, `apps/server/package.json`, `apps/server/scripts/smoke-test-dev.ts`)

## ⚠️ Alex-only follow-up before this does anything

1. Add the `PROD_DATABASE_URL` GitHub Actions secret (repo Settings → Secrets and variables → Actions) — the same prod Neon root-branch connection string already set as `questlog-prod`'s Fly `DATABASE_URL` secret. Not attempted here, per the ticket's own explicit instruction.
2. Once that secret exists, confirm a real workflow run succeeds — either wait for a `main` push (once `questlog-prod`'s Fly dashboard GitHub integration is connected, `Docs/DEPLOY_SETUP_CHECKLIST.md` §2) or trigger `smoke-test-prod.yml` manually via `workflow_dispatch` from the Actions tab.
3. Only then does M-CICD.3's milestone checkbox flip — left unchecked in `Docs/milestones/MILESTONES_V1_1_MCP.md` for now, per this ticket's own Definition of Done.

## What shipped

A new GitHub Actions workflow (`.github/workflows/smoke-test-prod.yml`), triggered on push to `main` (plus `workflow_dispatch` for on-demand runs, mirroring `smoke-test-dev.yml`), that polls `questlog-prod`'s `/health` endpoint until the deploy is live, then runs a **read-only** verification pass against prod: `apps/server/scripts/smoke-test-dev.ts` gained a `--read-only` CLI flag (wired to a new `smoke:prod` package.json script) that runs `/health` and a schema/extensions check only — no `campaign.create`/`campaign.list` round trip, no cleanup delete, no write of any kind. The schema/extensions check itself was extracted into a shared `checkSchemaAndExtensions()` helper used by both the existing full round trip (`smoke:dev`) and the new read-only path (`smoke:prod`), so the two share one implementation rather than forking a duplicate copy.

## Test evidence

```
$ DATABASE_URL=postgresql://questlog:questlog@localhost:5433/questlog_test bash scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (642 passed)
```

`actionlint` against the new workflow file:
```
$ /tmp/actionlint -color .github/workflows/smoke-test-prod.yml
$ echo $?
0
```

Full local run of the read-only mode against a locally-booted `apps/server` instance + local Postgres, using the exact command the workflow now runs (`pnpm --filter @questlog/server smoke:prod <url>`), with a pre-existing row inserted first to prove no write occurs:

```
$ psql ... -c "INSERT INTO campaigns (id, name, theme) VALUES ('11111111-1111-1111-1111-111111111111', 'T-037 pre-existing row', 'fantasy');"
INSERT 0 1

$ DATABASE_URL=postgresql://questlog:questlog@localhost:5433/questlog \
  pnpm --filter @questlog/server smoke:prod "http://localhost:3099"

> @questlog/server@0.0.0 smoke:prod /home/user/QuestLog/apps/server
> tsx scripts/smoke-test-dev.ts --read-only http://localhost:3099

Smoke-testing http://localhost:3099 (read-only)
  /health OK
  schema OK (13 expected tables present)
  extensions OK (vector, pg_trgm)
PASS — /health -> schema -> extensions succeeded against http://localhost:3099 (read-only, no writes issued).
$ echo $?
0

$ psql ... -c "SELECT id, name, theme FROM campaigns;"
                  id                  |          name          |  theme
--------------------------------------+------------------------+---------
 11111111-1111-1111-1111-111111111111 | T-037 pre-existing row | fantasy
(1 row)
```

The pre-existing row is the only row present, unchanged, after the read-only run — confirming no write was issued. (Row deleted afterward as test cleanup, via direct SQL, not by the script under test.)

For completeness, `smoke:dev`'s existing full round trip was also re-run against the same local server to confirm the refactor didn't change its behavior:

```
$ DATABASE_URL=postgresql://questlog:questlog@localhost:5433/questlog \
  pnpm --filter @questlog/server smoke:dev "http://localhost:3099"
...
Smoke-testing http://localhost:3099
  /health OK
  campaign.create OK (8ddf3f10-c29d-49f8-b333-8d6ed82db668)
  campaign.list OK
  schema OK (13 expected tables present)
  extensions OK (vector, pg_trgm)
  migrations OK (14/14 applied)
  cleaned up campaign 8ddf3f10-c29d-49f8-b333-8d6ed82db668
PASS — /health -> campaign.create -> campaign.list -> schema -> extensions -> cleanup succeeded against http://localhost:3099.
$ echo $?
0
```

## Exit condition check

- **All tests green, typecheck clean, lint clean — pasted output, not a summary.** ✅ above.
- **The new workflow YAML is valid.** ✅ — `actionlint` exits 0 (above).
- **The shared verification script's read-only mode, run locally against a real or realistic local Postgres, completes schema/extension checks without issuing any write — demonstrate by running it against a database with an existing row and confirming that row is untouched afterward.** ✅ above — the pre-existing marker row survived the read-only run untouched, and it was the only row present both before and after.

## Reviewer verdict

**PASS**, verbatim (from the `reviewer` subagent, run against `git diff develop feat/m-cicd/t-037-post-merge-smoke-test-prod`):

> **Correctness — read-only control flow.** `apps/server/scripts/smoke-test-dev.ts:107-115`: the `if (readOnly) { ... return; }` branch runs `/health` then `checkSchemaAndExtensions()` (lines 46-76, `information_schema.tables`/`pg_extension` SELECTs only) and returns unconditionally *before* reaching `campaign.create` (line 122) or the `try/finally` cleanup `DELETE` (line 163). There is no code path from `readOnly === true` into any write statement — verified by reading the full function body, not just the diff hunks. Good.
>
> **Argv parsing verified empirically.** `smoke:prod` bakes `--read-only` into the npm script (`apps/server/package.json:22`) and the workflow appends the URL as an extra CLI arg (`smoke-test-prod.yml:67`). I confirmed with a throwaway pnpm script that this correctly produces `argv = ["--read-only", "<url>"]` regardless of order... The workflow also correctly avoids T-036's known `pnpm --filter <pkg> run <script> -- <args>` `--`-mis-forwarding bug ... by using the same `pnpm --filter @questlog/server smoke:prod "$PROD_BASE_URL"` form (no `run`, no `--`) that T-036 landed on after its own remediation.
>
> **Scope adherence.** No write path against prod under any flag — confirmed above. `.github/workflows/smoke-test-dev.yml` — zero diff, satisfying "no changes ... beyond what's needed" trivially. `PROD_DATABASE_URL` — only referenced via `${{ secrets.PROD_DATABASE_URL }}`; never added to any repo config. Trigger is `push: branches: [main]` plus `workflow_dispatch`, matching Scope.
>
> **DRY.** `checkSchemaAndExtensions()` is extracted once and called from both the read-only and full paths — the script is genuinely reused via a flag, not forked.
>
> **YAML sanity.** Parses as valid YAML. Secret scoped to the one step's `env:`, matching the dev sibling's pattern.
>
> No functionality gaps, no scope creep, no test theater, no unresolved DRY sprawl.
>
> PASS

## Anything Alex must decide

- **Environment gap found and fixed, unrelated to this ticket's scope**: this session's sandbox was missing `packages/core/node_modules` and `packages/mcp/node_modules` entirely (an incomplete `pnpm install` from session start), which made `pnpm typecheck` fail with dozens of unrelated "cannot find module" errors. Fixed by re-running `pnpm install` at the repo root before starting work — confirmed via `git stash` that the same failures reproduced on a clean `develop` checkout, so this was pre-existing environment breakage, not something this diff introduced or needs to carry a fix for. Also found and fixed: two per-package test databases (`questlog_test_core`, `questlog_test_server`) and the local dev database (`questlog`) were missing/behind on migrations in this sandbox — created/migrated them directly rather than letting `pnpm test`/the manual verification silently fail. No code or ticket-pipeline change needed; flagging in case the same gap recurs in a future session.
- No 🧠 strategy gates encountered in this ticket's scope.
- See the checklist at the top of this report for the one required Alex-only step (`PROD_DATABASE_URL` secret) before this workflow does anything on a real `main` push.
