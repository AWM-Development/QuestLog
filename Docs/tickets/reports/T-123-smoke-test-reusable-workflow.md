# T-123 — Merge smoke-test-dev.yml / smoke-test-prod.yml into one reusable workflow

**Outcome:** shipped
**Branch:** feat/m-efficiency/t-123-smoke-test-reusable-workflow
**Diff:** 3 workflow files changed, +87/-82 lines (plus a ticket-file move, no content change)
**Complexity tier:** S
**Strategy-gate flag:** no

## What shipped

A new reusable workflow, `.github/workflows/smoke-test.yml` (`workflow_call`), now holds the shared checkout/install/poll-`/health`/run-smoke-test steps `smoke-test-dev.yml` and `smoke-test-prod.yml` previously duplicated. Both callers became thin: each keeps its own distinct `on:` trigger and passes its own `base-url-env-name`/`base-url`/`smoke-script` inputs plus a scoped `DATABASE_URL` secret. Both callers also picked up `.github/actions/setup-repo` (via the reusable workflow, internally) in place of separately-pinned `actions/checkout@v4`/`pnpm/action-setup@v4`/`actions/setup-node@v4` steps, closing the `@v4`/`@v5` drift T-117's audit flagged (finding #2) without a separate version-bump ticket.

## Test evidence

```
$ bash scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (836 passed)
```

```
$ actionlint .github/workflows/smoke-test.yml .github/workflows/smoke-test-dev.yml .github/workflows/smoke-test-prod.yml
$ echo $?
0
```

## Exit condition check

- **`.github/workflows/smoke-test.yml` exists as a `workflow_call` reusable workflow containing the shared checkout/install/poll/run steps.** ✅ — see the file: `on: workflow_call:` with `inputs`/`secrets`, one `smoke-test` job whose steps are `uses: ./.github/actions/setup-repo`, poll `/health`, then `pnpm --filter @questlog/server ${{ inputs.smoke-script }}`.
- **`smoke-test-dev.yml` and `smoke-test-prod.yml` each call it via `uses: ./.github/workflows/smoke-test.yml` with their own environment-specific inputs/secrets, and each still declares its own distinct `on:` trigger unchanged from today.** ✅ — `smoke-test-dev.yml` keeps `on: push: branches: [develop]` + `workflow_dispatch`; `smoke-test-prod.yml` keeps `on: push: branches: [main]` + `workflow_dispatch`, both byte-identical to their pre-refactor triggers. Each `jobs.<job>.with`/`.secrets` block supplies its own `DEV_BASE_URL`/`PROD_BASE_URL`, `smoke:dev`/`smoke:prod`, and `DEV_DATABASE_URL`/`PROD_DATABASE_URL`.
- **Both caller files use `.github/actions/setup-repo` (or the reusable workflow itself does, internally) — zero remaining `actions/checkout@v4`/`pnpm/action-setup@v4`/`actions/setup-node@v4` references in either file.** ✅ — confirmed via `grep -rn "checkout@v4\|action-setup@v4\|setup-node@v4" .github/workflows/smoke-test-dev.yml .github/workflows/smoke-test-prod.yml` returning no matches (neither caller has any checkout/setup steps left at all — those steps now live once, inside `smoke-test.yml`, via `setup-repo`).
- **A `workflow_dispatch` run of both `smoke-test-dev.yml` and `smoke-test-prod.yml` completes the same steps in the same order as before the refactor (verified via Actions run logs).** Not verifiable from this sandbox — no live GitHub Actions run against real secrets is possible here. Statically verified instead: `actionlint` passes clean on all three files (above), and the reusable workflow's step sequence (setup-repo → poll `/health` → run smoke script) is unchanged from each caller's pre-refactor inline sequence, just relocated. Flagged under "Anything Alex must decide" below for the one live check this sandbox can't perform.
- **All tests green, typecheck clean, lint clean.** ✅ — see Test evidence above.

## Reviewer verdict

PASS — "Findings summary: none rise to a real concern. The diff delivers exactly what Scope specifies, respects Out of scope boundaries, meets every bullet of the Exit condition that's checkable statically (the `workflow_dispatch` run verification is procedural and outside diff review scope), and shows no pattern deviation, scope creep, test theater, or DRY violation." (Noted separately, not a finding: YAML structure was visually verified and matches GitHub Actions `workflow_call` schema correctly.)

## Efficiency notes

Tight run — the ticket's Context files list was sufficient (the two existing caller workflows, the `setup-repo` composite action T-120 already built, and T-117's audit finding). One real iteration: an initial draft kept each caller's own `env:` block and referenced it from `with:` (`base-url: ${{ env.DEV_BASE_URL }}`); `actionlint` caught that `env` isn't an allowed context there, fixed by inlining the literal URL directly into `with.base-url` instead. Config-only S-tier ticket, so no Red/Green TDD loop applied (`EXECUTOR_ROUTINE.md` Step 4's docs/config-only branch) — verification was `actionlint` plus one end-of-work `scripts/run-tests-quiet.sh` pass.

**Retry log:** 1 retry, `mechanical_lint_typecheck` (actionlint's `env`-context-not-allowed-in-`with` finding, not a test failure).

## Anything Alex must decide

- **Live `workflow_dispatch` verification of both workflows is still outstanding** — this sandbox can't trigger a real GitHub Actions run against `DEV_DATABASE_URL`/`PROD_DATABASE_URL`. Once this PR merges, trigger `workflow_dispatch` for both `smoke-test-dev.yml` and `smoke-test-prod.yml` from the Actions tab (or wait for the next `develop`/`main` push) and confirm the run logs show the same setup → poll → smoke-test sequence as before. This is the one exit-condition bullet not mechanically verified here.
- No 🧠 strategy gates encountered in this ticket's scope.
