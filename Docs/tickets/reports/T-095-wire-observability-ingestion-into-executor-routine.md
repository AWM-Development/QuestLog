# T-095 — Wire observability ingestion into the executor routine

**Outcome:** shipped
**Branch:** feat/m-obs/t-095-wire-observability-ingestion-into-executor-routine
**Diff:** 4 files changed, +140/-13 lines (`Docs/tickets/EXECUTOR_ROUTINE.md`, `packages/observability/package.json`, `packages/observability/src/cli.ts`, `packages/observability/src/cli.test.ts` new)
**Complexity tier:** M
**Strategy-gate flag:** no

## ⚠️ Alex-only follow-up before this does anything

1. Provision the real `OBSERVABILITY_DATABASE_URL` — a Neon branch under the same project as the existing observability schema (`G-003-observability-data-storage-location.md`'s resolution) — and set it as a secret in the nightly executor's own environment. Not attempted here, per the ticket's own explicit "Mixed autonomy" instruction; do not put a real connection string anywhere in this session's output.
2. Once that secret exists, confirm a real ticket's wrap-up actually writes a row to the live store (not just that the local graceful-degradation path works, which this report already proves).
3. Only then does M-OBS.3b's milestone checkbox flip — left unchecked in `Docs/milestones/MILESTONES_V1_2_MCP.md` for now, per this ticket's own Definition of done.

## What shipped

`EXECUTOR_ROUTINE.md`'s Step 7 (shipped path) and Step 6 (blocked path) now each run `packages/observability`'s `ingest` CLI against the ticket's just-produced `usage.json` and report, right after the existing usage-capture invocation — closing the gap T-053 explicitly left open (the store and CLI existed, but nothing in the routine ever called them). The CLI's guarded entry point is now an exported, independently-tested `runIngestCli`, with a missing or unreachable `OBSERVABILITY_DATABASE_URL` degrading to a logged warning and a clean exit rather than failing the wrap-up. Three real, previously-latent bugs were found and fixed while proving this end-to-end (all three via actually running the invocation, not from the checkpoint unit tests alone — see `Docs/IMPLEMENTATION_NOTES.md` § T-095 for full detail on each):
1. The CLI never closed its DB connection on a successful run, so the bare script hung instead of exiting.
2. `pnpm --filter <pkg> run <script> -- <args>` — this ticket's own exit-condition wording — forwards a literal `--` as the script's first argument on this repo's pnpm; the routine now uses T-036's established `pnpm --filter <pkg> <script> <args>` form instead (the CLI also strips a leading `--` defensively, since the exit condition's own wording still uses it).
3. `pnpm --filter <pkg> <script>` shifts the script's own cwd to that package's directory, so the routine's original bare relative file-path arguments (`Docs/tickets/cost-reports/T-###.usage.json`) resolved against the wrong directory — the same class of bug T-069 already fixed once for `capture-usage`'s `CLAUDE_PROJECT_DIR`, just on a different argument this time. Fixed by passing `"$(pwd)/Docs/tickets/..."` (absolute) instead.

## Test evidence

```
$ bash scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (737 passed)
```

Per-package breakdown from the same run (`packages/observability` shown in full since this ticket's own new tests live there; other packages unaffected and included only for the aggregate count above):

```
@questlog/observability:test:  ✓ src/cli.test.ts (4 tests) 20ms
@questlog/observability:test:  ✓ src/ingest.test.ts (6 tests) 6ms
@questlog/observability:test:  ✓ src/ingest-db.test.ts (6 tests) 121ms
@questlog/observability:test:  Test Files  3 passed (3)
@questlog/observability:test:       Tests  16 passed (16)

@questlog/core:test:  Test Files  29 passed (29)
@questlog/core:test:       Tests  279 passed (279)
@questlog/server:test:  Test Files  14 passed (14)
@questlog/server:test:       Tests  103 passed (103)
@questlog/mcp:test:  Test Files  2 passed (2)
@questlog/mcp:test:       Tests  77 passed (77)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
```

End-to-end manual verification of the real CLI (not just the injected-`argv` unit tests), against the local `questlog_test_observability` database:

```
$ OBSERVABILITY_DATABASE_URL="postgresql://questlog:questlog@localhost:5433/questlog_test_observability" \
  pnpm --filter @questlog/observability ingest src/__fixtures__/T-999.usage.json src/__fixtures__/T-999-fixture-report.md
> tsx src/cli.ts src/__fixtures__/T-999.usage.json src/__fixtures__/T-999-fixture-report.md
Ingested src/__fixtures__/T-999.usage.json
$ echo $?
0

# unset OBSERVABILITY_DATABASE_URL
$ pnpm run ingest -- src/__fixtures__/T-999.usage.json src/__fixtures__/T-999-fixture-report.md
Observability ingestion skipped — OBSERVABILITY_DATABASE_URL environment variable is required
$ echo $?
0

# unreachable host
$ OBSERVABILITY_DATABASE_URL="postgres://user:pass@127.0.0.1:1/db" pnpm run ingest -- src/__fixtures__/T-999.usage.json src/__fixtures__/T-999-fixture-report.md
Observability ingestion skipped — Failed query: select "id" from "ticket_runs" where "ticket_runs"."ticket_id" = $1
params: T-999
$ echo $?
0
```

Both graceful-degradation cases above were run via the buggy `pnpm run ingest -- <args>` form deliberately, to prove the CLI's own `--`-stripping defense holds even when the routine's recommended safer form isn't used.

And, from the worktree root, the exact invocation `EXECUTOR_ROUTINE.md`'s Step 7 now uses — absolute paths, no `run`, no `--` — run against this ticket's own real artifacts (a third bug, a bare-relative-path cwd mismatch, was found and fixed via this exact command; see `Docs/IMPLEMENTATION_NOTES.md` § T-095):

```
$ OBSERVABILITY_DATABASE_URL="postgresql://questlog:questlog@localhost:5433/questlog_test_observability" \
  pnpm --filter @questlog/observability ingest "$(pwd)/Docs/tickets/cost-reports/T-095.usage.json" "$(pwd)/Docs/tickets/reports/T-095-wire-observability-ingestion-into-executor-routine.md"
Ingested /home/user/QuestLog/tmp/worktrees/T-095/Docs/tickets/cost-reports/T-095.usage.json
$ echo $?
0
```

## Exit condition check

- **All tests green, typecheck clean, lint clean.** ✅ pasted above.
- **`pnpm --filter @questlog/observability run ingest -- <fixture usage.json path> <fixture report path>` successfully ingests both fixtures against a real local test DB.** ✅ — verified with both the ticket's literal `run ... --` wording and the routine's actual (safer) invocation form; see "End-to-end manual verification" above. The literal wording only works because of the `--`-stripping fix documented in `Docs/IMPLEMENTATION_NOTES.md` § T-095 — without it, that exact command would have silently no-op'd.
- **`EXECUTOR_ROUTINE.md`'s Step 7 names the exact ingestion invocation, positioned after the `capture-usage` step and before the wrap-up commit; Step 6 names the equivalent for the blocked path.** ✅ — `EXECUTOR_ROUTINE.md:116` (Step 6, after usage-capture, before the push-for-inspection bullet) and `:128` (Step 7, after usage-capture, before "Commit all of the above").
- **Given `OBSERVABILITY_DATABASE_URL` unset (or pointed at an unreachable host), a test proves the wired-in ingestion path logs a warning and returns/exits without throwing uncaught.** ✅ — `packages/observability/src/cli.test.ts`'s first two cases (unset via a rejecting `loadDb`, unreachable via a real `postgres()` connection to `127.0.0.1:1` with a short `connect_timeout`), plus the manual end-to-end runs above.

## Reviewer verdict

**PASS-WITH-NOTES**, verbatim (from the `reviewer` subagent, run against `git diff origin/develop..HEAD` at commit `7094b70`, before the remediation pass below):

> **Scope coverage against the ticket.** All four Scope bullets are present in the reviewed commit (`7094b70`): `packages/observability/package.json:18` adds the named `ingest` script; `Docs/tickets/EXECUTOR_ROUTINE.md:128` and `:116` insert the ingestion step into Step 7 (shipped) and Step 6 (blocked) respectively, each correctly positioned after `capture-usage` and before the wrap-up commit / push; `packages/observability/src/cli.ts` makes a missing/unreachable `OBSERVABILITY_DATABASE_URL` non-fatal via `runIngestCli`'s try/catch + `warnIngestionSkipped`. Verified empirically that `pnpm --filter <pkg> run <script> -- <args>` really does forward a literal `--` as `argv[0]` on this repo's pnpm (9.15.5) — the stripping logic at `cli.ts:76` is a real, justified fix, not invented busywork, and is required for the exit condition's own literal invocation form to actually ingest anything rather than silently no-op every night.
>
> **Tests.** `packages/observability/src/cli.test.ts` is not theater — the "unreachable host" case (`cli.test.ts:47-61`) makes a real `postgres()` connection attempt to `127.0.0.1:1` with a short `connect_timeout`, genuinely exercising the failure path rather than mocking it away. The `--`-stripping test (`cli.test.ts:73-96`) asserts on the specific error-message shape to distinguish "reached `--`'s ENOENT" from "reached the real fixture," which is a real assertion, not a vacuous one. Pre-existing `ingest-db.test.ts` (untouched, still exercises `ingestUsageArtifact` against a real test DB) continues to pass since the exported `ingestUsageArtifact` signature is unchanged.
>
> **Pattern conformance.** Matches `.claude/rules/scripts.md`'s dual-mode shape (`runIngestCli` exported and independently tested, the guarded `import.meta.url` block reduced to a thin shell) and its "close the live `db` singleton" rule (`cli.ts:99`, `finally` block). No schema/migration changes, consistent with `.claude/rules/db.md` not being implicated.
>
> **No scope creep found.** `Out of scope` items (no backfill, no schema/`ingest.ts` changes, no read-API work, no milestone-checkbox flip) are all respected — confirmed no diff to `Docs/milestones/`.
>
> **Finding — comment discipline (PASS-WITH-NOTES, not blocking).** `cli.ts:69-75` is a 7-line prose paragraph justifying a one-line fix, and the same rationale is spelled out again nearly verbatim in `cli.test.ts` and a third time in `IMPLEMENTATION_NOTES.md`'s T-095 entry. Per `CLAUDE.md`'s "Comments: WHY only, once," this should collapse to the one `IMPLEMENTATION_NOTES.md` entry plus a one-line pointer at each call site. Similarly, `cli.ts:50-53`'s comment above `warnIngestionSkipped` and `cli.test.ts:10-14`'s `describe`-block comment restate the same "why must ingestion be non-fatal" rationale in full prose at two sites — same fix applies.
>
> No functionality gaps, no test theater, no scope creep found.
>
> PASS-WITH-NOTES

**Remediation (not required by PASS-WITH-NOTES, done anyway since the finding cites an explicit `CLAUDE.md` rule and was cheap to fix):** collapsed both duplicated comment paragraphs (`cli.ts:50-53`, `cli.ts:69-75`, and their `cli.test.ts` mirrors) down to one-line pointers at `Docs/IMPLEMENTATION_NOTES.md` § T-095, which now carries the full rationale for both (why ingestion must be non-fatal, and the `--`-stripping bug/fix). Full gate re-run clean afterward (see Test evidence above, from the post-remediation state).

## Efficiency notes

Straightforward ticket overall — the Scope was precisely bounded (four concrete bullets, all independently verifiable) and every named Context file was directly relevant. The bulk of the session's time went into actually proving the exit condition end-to-end rather than trusting the unit tests alone, which is what surfaced both real bugs below; a narrower "does `ingestUsageArtifact` still work" check would have missed both.

**Retry log:**
- 1 `environment_setup` — `questlog_test_observability` was migrated only through `0000_nebulous_gambit` (missing `0001_serious_logan`), a pre-existing sandbox gap unrelated to this ticket's own schema (see `Docs/IMPLEMENTATION_NOTES.md` § T-095 for the root cause in `session-start.sh`'s fast-path check). Fixed by running `db:migrate` directly against that database before continuing.
- 1 `genuine_bug_caught_by_test` — the CLI's real `--`-forwarding bug (found while manually running the exit condition's literal command, then proven with a dedicated Red test before fixing).
- 1 `mechanical_lint_typecheck` — a single Biome line-wrap fix (`cli.ts`'s argv-destructure line), auto-applied via `biome check --write`.

0 retries were `genuine_bug_caught_by_test` failures against the ticket's actual Red/Green checkpoints themselves — the graceful-degradation implementation passed on the first Green pass; the bug above was found through manual end-to-end verification after the checkpoint was already green, not through a failing checkpoint test.

## Anything Alex must decide

- See the checklist at the top of this report for the required Alex-only step (`OBSERVABILITY_DATABASE_URL` secret) before this wiring does anything against the real store.
- **Pre-existing gap found, not fixed here (out of scope):** `session-start.sh`'s T-125 fast-path (`db_readiness_issue()`) only checks that a database has *at least one* applied migration, not that it matches the journal's latest entry — so a database migrated once in an earlier session silently stops getting re-migrated even after new migrations land, across every package's test DB, not just observability's. Worth a follow-up ticket if it recurs; full detail in `Docs/IMPLEMENTATION_NOTES.md` § T-095.
- No 🧠 strategy gates encountered in this ticket's scope.
