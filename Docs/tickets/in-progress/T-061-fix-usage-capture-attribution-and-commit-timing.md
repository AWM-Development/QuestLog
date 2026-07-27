# T-061 — Fix usage-capture artifact attribution and commit timing

Milestone ref: none — pipeline/tooling hygiene, same category as T-027/T-043/T-052/T-060. Resolves `G-011` (`Docs/tickets/gated/resolved/G-011-usage-capture-attribution-and-commit-timing.md`); M-OBS.1 (T-046) itself is already shipped and its checkbox stays `[x]` — this is a fix to bugs discovered in that shipped feature.

Priority: P0

Branch: chore/pipeline/t-061-fix-usage-capture-attribution-and-commit-timing

Context files (load ONLY these):
  - packages/core/src/observability/capture-usage.ts (`captureUsage`, `resolveTicketIdFromRepo` — the function being replaced)
  - packages/core/src/observability/usage-summary.ts (`resolveTicketId`, `resolveArtifactPath`)
  - packages/core/src/observability/capture-usage.test.ts and usage-summary.test.ts (existing coverage for the functions above, to update alongside the behavior change)
  - .claude/hooks/session-start.sh (where the new stash-write is added)
  - .claude/hooks/stop-usage-capture.sh (confirm no code change is actually needed here — see Scope)
  - .claude/settings.json (SessionStart/Stop hook registration, for reference only)
  - Docs/tickets/EXECUTOR_ROUTINE.md Step 2 and Step 7 (the two steps being rewritten)
  - Docs/IMPLEMENTATION_NOTES.md § T-046 (the stale "known limitation" paragraph to correct)
  - Docs/tickets/gated/resolved/G-011-usage-capture-attribution-and-commit-timing.md (the resolved decision and rationale this ticket implements)

Mockup: none

Model: sonnet

Scope:
  Two related bugs, resolved via `G-011`, both traced to the same root cause: `capture-usage.ts`'s ticket attribution is a guess (last 5 commit subjects, else newest file in `done/`/`blocked/`) rather than an explicit signal, and the artifact is only ever written by the `Stop` hook, which doesn't fire until *after* an autonomous run's Step 7 has already committed and opened the PR — so the artifact never makes it into the PR, and any unrelated session's guess can silently overwrite a real ticket's cost record. Implement the resolved design:

  1. **`.claude/hooks/session-start.sh`**: on every invocation, write the hook's own stdin payload's `transcript_path` and `session_id` to a scratch file at `.claude/.session-context.json` (plain JSON, e.g. `{"transcript_path": "...", "session_id": "..."}`). Do this unconditionally, before the existing remote-only Postgres-provisioning logic (which still only runs when `CLAUDE_CODE_REMOTE=true`) — the stash itself must happen for every session, local or remote.

  2. **`Docs/tickets/EXECUTOR_ROUTINE.md` Step 2**: immediately after creating the feature branch, write the ticket id being picked up to `.claude/.active-ticket` (plain text, e.g. `T-061`). This is the explicit "this session is doing real ticket work" signal that replaces the old heuristic. Also handle Step 1's resume path (a previously in-progress ticket being picked back up) — the marker must exist whenever a session is actively working *any* ticket, not just on first pickup.

  3. **`Docs/tickets/EXECUTOR_ROUTINE.md` Step 7**: before the wrap-up commit, run `cat .claude/.session-context.json | pnpm --filter @questlog/server run capture-usage` directly (reusing the exact existing CLI entrypoint and stdin payload shape unchanged — no new CLI needed, since the stash file has the identical shape the `Stop` hook already pipes in). Include the resulting `Docs/tickets/cost-reports/T-###.usage.json` in the same commit as the rest of wrap-up. After committing, delete `.claude/.active-ticket` (ticket work for this session is done).

  4. **`packages/core/src/observability/usage-summary.ts`**: replace `resolveTicketId`'s signature and implementation — it currently takes `{ recentCommitSubjects, doneAndBlockedFiles }` and greps commit subjects/file mtimes for a `T-\d+` pattern. Change it to take the active-ticket marker's contents directly (e.g. `resolveTicketId(activeTicketMarker: string | null): string | null`) — trimmed marker content if present and non-empty, `null` otherwise. Delete the commit-subject/mtime-heuristic logic entirely; it must not remain as a fallback.

  5. **`packages/core/src/observability/capture-usage.ts`**: update `resolveTicketIdFromRepo` (rename if it no longer reads "from repo" — e.g. `resolveActiveTicketId`) to read `.claude/.active-ticket` (via `existsSync`/`readFileSync`, returning `null` if absent) and pass its contents to the new `resolveTicketId`. Remove the `execSync("git log ...")` call and the `doneAndBlockedFiles` directory scan entirely.

  6. **`.claude/hooks/stop-usage-capture.sh`**: confirm (and note in the report) that no code change is needed — it already just pipes the hook's own fresh stdin payload into the CLI unchanged; the only change is that `resolveTicketId` now reads the marker instead of guessing, so a `Stop` fire with no active-ticket marker correctly falls through to `empty_run: true` instead of attributing to some unrelated recently-touched ticket.

  7. **`Docs/IMPLEMENTATION_NOTES.md` § T-046**: correct the "Usage artifacts live in..." note's closing paragraph — it currently states the committed number reflects "the session as of the *previous* hook fire" because of `Stop`-hook timing; that's no longer true once Step 7 invokes capture-usage directly and synchronously. Update it to describe the new mechanism (SessionStart stash + explicit marker + direct Step 7 invocation) and add a one-line pointer to `G-011`'s resolution for the full rationale, per `CLAUDE.md`'s "WHY only, once" rule.

Out of scope:
  - No change to `Docs/tickets/cost-reports/`'s file-naming scheme (still keyed by ticket id, one file per ticket) or the artifact's own JSON schema — this ticket fixes attribution reliability and commit timing, not the storage shape.
  - No change to `resolveArtifactPath`'s `empty-run-<session_id>.usage.json` naming for unresolved sessions.
  - No dashboard, Neon ingestion, or reconciliation-across-sessions machinery (that's M-OBS.3/T-053 territory, unaffected by this fix).
  - No retroactive repair of already-corrupted historical artifacts (e.g. T-049's overwritten record, or the three untracked files currently sitting in `Docs/tickets/cost-reports/` on-disk at ticket-draft time) — this ticket prevents recurrence, it does not restore already-lost data.
  - No handling for multiple simultaneous active-ticket markers or parallel ticket execution — the pipeline runs one ticket at a time by design elsewhere in `EXECUTOR_ROUTINE.md`; a single scalar marker file is sufficient.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `usage-summary.test.ts` proves the new `resolveTicketId(activeTicketMarker)` returns the marker's (trimmed) content when present and non-empty, and `null` when absent/empty — with no remaining code path that reads git log or directory mtimes.
  - `capture-usage.test.ts` proves: given a fixture transcript, a stashed session-context, and a marker naming ticket `T-XXX`, `captureUsage` writes `Docs/tickets/cost-reports/T-XXX.usage.json` tagged with that id — and, in the same test suite, that with no marker file present, the same fixture transcript produces `empty_run: true`, **even when a fixture `done/`/`blocked/` directory or recent commit history would point at a different ticket** — this is the exact regression (an unrelated session's guess overwriting a real ticket's record) that must be provably impossible after this ticket, not just "the heuristic changed."
  - A test or direct invocation of `session-start.sh` (fake stdin payload) proves `.claude/.session-context.json` is written with the correct `transcript_path`/`session_id` shape.
  - `Docs/tickets/EXECUTOR_ROUTINE.md` Steps 2 and 7 read coherently end-to-end: Step 2 writes the marker, Step 7 reads the stash and marker, invokes the CLI, commits the artifact inline, and clears the marker — reviewed manually for correctness since the routine's own prose isn't unit-testable, but must not contradict the code changes above.
  - `Docs/IMPLEMENTATION_NOTES.md` § T-046 no longer claims the committed usage number reflects "the previous hook fire."

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: no milestone checkbox to flip (see Milestone ref above),
  IMPLEMENTATION_NOTES.md updated per Scope item 7 above,
  a CHANGELOG.md entry under [Unreleased] (tooling/dev-experience, not user-facing),
  morning report written.
