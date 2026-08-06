# T-095 — Wire observability ingestion into the executor routine

**Mixed autonomy.** The code/wiring work below (`ingest` script, the
`EXECUTOR_ROUTINE.md` Step 6/7 insertions, graceful degradation when
`OBSERVABILITY_DATABASE_URL` is absent) is normal nightly-eligible work.
Provisioning the real Neon branch and setting `OBSERVABILITY_DATABASE_URL`
in the nightly executor's own environment is Alex-only (same category as
every other real-credential step in `Docs/DEPLOY_SETUP_CHECKLIST.md`) —
write it up as an explicit to-do, do not attempt it, and do not put a real
connection string anywhere in this session's output.

Milestone ref: M-OBS.3b

Complexity tier: M

Strategy-gate flag: no

Priority: P1

Branch: feat/m-obs/t-095-wire-observability-ingestion-into-executor-routine

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md (Step 6 and Step 7 — exact insertion points, and the existing `capture-usage` invocation this mirrors)
  - packages/observability/src/cli.ts (the `ingestUsageArtifact` entry point this wires in)
  - packages/observability/src/db/index.ts (throws at import time if `OBSERVABILITY_DATABASE_URL` is unset — the failure mode this ticket must make non-fatal)
  - packages/observability/package.json (add a named `ingest` script here, mirroring this file's existing `db:migrate` script's shape)
  - packages/observability/src/ingest-db.test.ts (existing fixture/idempotency test pattern to extend, not replace)
  - Docs/tickets/gated/resolved/G-003-observability-data-storage-location.md (Resolution section — confirms provisioning the real Neon branch/`OBSERVABILITY_DATABASE_URL` secret is Alex's manual step, not this ticket's)
  - Docs/tickets/done/T-037-post-merge-smoke-test-prod.md (reference for this ticket's own shape: mixed-autonomy framing, deferred milestone checkbox, report-checklist convention — do not otherwise reuse its content, unrelated subsystem)
  - Docs/IMPLEMENTATION_NOTES.md § T-069 (the `capture-usage` synchronous-invocation wiring this ticket's shape follows)

Mockup: none

Model: sonnet

Scope: T-053 built `packages/observability`'s store and CLI (`ingestUsageArtifact`) but explicitly left live-pipeline wiring as a follow-up (see its own report and `Out of scope`) — no ticket for that follow-up was ever drafted, so nothing in `EXECUTOR_ROUTINE.md` calls it today; every ticket's `usage.json`/report currently only reaches the store via a manual CLI invocation. This ticket closes the code/wiring half of that gap:
  - Add an `ingest` script to `packages/observability/package.json` (`"ingest": "tsx src/cli.ts"`), matching the existing `db:migrate` script's shape, so the routine invokes a named pnpm script rather than a bare `tsx` path — consistent with how it already invokes `capture-usage`.
  - Insert one step into `EXECUTOR_ROUTINE.md`'s Step 7 (shipped path), immediately after the `capture-usage` invocation and the morning report being written, that runs the ingestion script against this ticket's just-produced `Docs/tickets/cost-reports/T-###.usage.json` and `Docs/tickets/reports/T-###-slug.md` — before the final wrap-up commit, so the ingested write and everything else land together.
  - Insert the equivalent step into Step 6 (blocked path), against the just-produced usage.json and `Docs/tickets/blocked/T-###-slug.md` blocked report.
  - Make ingestion failure non-fatal to the ticket's wrap-up — this is what makes it safe to wire in now, before Alex has provisioned the real secret. `packages/observability/src/db/index.ts` currently throws at import time if `OBSERVABILITY_DATABASE_URL` is unset; every future ticket's wrap-up now depends on this call, so a still-unprovisioned secret must never block a ticket from committing, pushing, and opening its PR. Wrap the routine's ingestion call (or adjust `cli.ts`'s guarded entry block) so a missing/invalid `OBSERVABILITY_DATABASE_URL` or a connection failure logs a clear warning and the routine continues.
  - Write up the required manual step (below) as the lead item of this ticket's morning report, per this ticket's own Definition of done.

Out of scope:
  - Provisioning the actual `OBSERVABILITY_DATABASE_URL` Neon branch/secret, or setting it in the nightly executor's environment — Alex-only, per the Mixed autonomy note above. Do not attempt this yourself.
  - No backfill of already-shipped tickets' historical `usage.json`/report files into the store (T-053's own `Out of scope` already excluded this; unchanged here).
  - No changes to `packages/observability`'s schema, `ingest.ts`'s mapping/upsert logic, or `cli.ts`'s argument shape beyond what graceful-failure handling requires — this ticket wires the existing entry point into the routine, it doesn't change what that entry point does.
  - No read-API or dashboard work (M-OBS.4/M-OBS.5 — T-054, T-055, T-057–T-059, separately ticketed).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `pnpm --filter @questlog/observability run ingest -- <fixture usage.json path> <fixture report path>` successfully ingests both fixtures against a real local test DB (reuses T-053's existing fixtures)
  - `EXECUTOR_ROUTINE.md`'s Step 7 names the exact ingestion invocation, positioned after the `capture-usage` step and before the wrap-up commit; Step 6 names the equivalent for the blocked path
  - given `OBSERVABILITY_DATABASE_URL` unset (or pointed at an unreachable host), a test proves the wired-in ingestion path logs a warning and returns/exits without throwing uncaught — a real assertion on that specific degradation path, not just "works when the DB is up"

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-OBS.3b in
  `Docs/milestones/MILESTONES_V1_2_MCP.md` is **not** applicable until Alex
  provisions the real `OBSERVABILITY_DATABASE_URL` (Neon branch + setting
  it in the nightly executor's environment) and confirms a real ticket's
  wrap-up actually writes a row to the live store — not just that the
  graceful-degradation path works locally. `IMPLEMENTATION_NOTES.md`
  updated with the new credential's existence/scope if not already covered
  by T-053's own entry, a `CHANGELOG.md` entry under `[Unreleased]`, morning
  report written with the secret-provisioning checklist front and center
  (numbered to-do at the top, same shape as T-037's report) — do not bury
  it in "Anything Alex must decide."
