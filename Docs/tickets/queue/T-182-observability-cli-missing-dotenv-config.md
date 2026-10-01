# T-182 — `packages/observability/src/cli.ts` never loads `.env`, silently no-op'ing local ingestion

Milestone ref: M-BUG.7

Complexity tier: S

Priority: P1

Branch: fix/m-bug/t-182-observability-cli-missing-dotenv-config

Context files (load ONLY these):
  - packages/observability/src/cli.ts (the file missing the fix)
  - packages/observability/src/db/migrate.ts (the sibling file with the correct pattern — `dotenv.config({ path: "../../.env" })`)
  - packages/observability/src/db/index.ts (reads `process.env.OBSERVABILITY_DATABASE_URL` directly, same as cli.ts — confirm whether this needs the same fix or is only ever reached after something else in the process has already loaded `.env`)
  - packages/observability/src/cli.test.ts (existing graceful-degradation tests — must keep passing)

Mockup: none

Model: sonnet

Scope: `db/migrate.ts` calls `dotenv.config({ path: "../../.env" })` before resolving `OBSERVABILITY_DATABASE_URL`; `cli.ts` (the `ingest` script's entry point) never does. `pnpm --filter @questlog/observability ingest <usage.json>` therefore only picks up `OBSERVABILITY_DATABASE_URL` when the invoking shell has separately exported it — not merely when it's present in the repo's `.env` — even though the graceful-degradation warning it prints on failure ("Observability ingestion skipped — OBSERVABILITY_DATABASE_URL environment variable is required") reads identically to the *intended* no-secret-provisioned case (T-095/G-003), giving no signal that `.env` actually has the var and the process just never loaded it. Discovered 2026-08-24: a bulk audit found only 1 of 94 local `*.usage.json` cost-report artifacts had ever actually reached the observability DB, despite `.env` carrying a valid `OBSERVABILITY_DATABASE_URL` in every affected worktree since T-131. Add the same `dotenv.config({ path: "../../.env" })` call `migrate.ts` uses to `cli.ts`, before it resolves/loads the DB module.

Out of scope:
  - No change to the graceful-degradation warning's wording or behavior when the var is genuinely absent (T-095's design) — this ticket only fixes cli.ts actually seeing a `.env`-provided value.
  - No retroactive re-ingestion of historical cost reports — that cleanup already ran manually (2026-08-24, all 93 backfilled tickets + the pre-existing empty-run artifact confirmed in the observability DB).
  - No change to `EXECUTOR_ROUTINE.md`'s Step 6/7 wording unless this ticket's own verification finds the routine's invocation form is affected (it currently isn't expected to be, since dotenv only fills in what the shell hasn't already set).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a new `cli.test.ts` case confirms `runIngestCli` resolves `OBSERVABILITY_DATABASE_URL` from a `.env` file when the shell environment does not already have it set (not just when `loadDb` is mocked/injected)
  - existing graceful-degradation tests (missing var, unreachable host) still pass unmodified in behavior

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_BUGS.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
