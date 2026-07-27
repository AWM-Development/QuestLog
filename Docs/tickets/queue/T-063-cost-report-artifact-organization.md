# T-063 — Organize cost-report artifacts: ticket vs. general, human-readable naming

Milestone ref: none — pipeline/tooling hygiene, same category as T-027/T-043/T-052/T-060/T-061/T-062. Direct request from Alex during a `/morning-review` session: `Docs/tickets/cost-reports/` mixes ticket-run artifacts (`T-###.usage.json`) with non-ticket-run artifacts named `empty-run-<session_id>.usage.json` in one flat directory, and the raw-UUID naming is unintelligible at a glance. A full DB-backed observability store is already planned (M-OBS.3/T-053 in `Docs/milestones/MILESTONES_V1_2_MCP.md`) but is future work; this ticket is a filesystem-level stopgap so `cost-reports/` stops accumulating unreadable junk in the meantime.

Priority: P0

Branch: chore/pipeline/t-063-cost-report-artifact-organization

Context files (load ONLY these):
  - packages/core/src/observability/usage-summary.ts (`resolveArtifactPath`, `summarizeUsage`, `UsageSummary` interface — the path-builder and the transcript-parsing function whose internal `firstTimestamp`/first-slash-command detection need surfacing)
  - packages/core/src/observability/usage-summary.test.ts
  - packages/core/src/observability/capture-usage.ts (`captureUsage`, `HookPayload` — calls `resolveArtifactPath` and writes the file)
  - packages/core/src/observability/capture-usage.test.ts
  - packages/core/src/observability/artifact.ts (`buildUsageArtifact` — confirm no changes needed here; the artifact's JSON *content* is out of scope, only its file location/name changes)
  - Docs/IMPLEMENTATION_NOTES.md § T-046 and § G-011 (background on why `ticket_id`/`empty_run` attribution works the way it does — do not change that logic, only where/how the result is named on disk)

Mockup: none

Model: sonnet

Scope:
  Reorganize where and how usage artifacts are written, without touching
  attribution logic (`resolveTicketId`/`resolveActiveTicketId`, the
  `empty_run`/`ticket_id` fields, or any pricing/token-summing code):

  1. **Split by kind.** `resolveArtifactPath` returns
     `Docs/tickets/cost-reports/tickets/T-###.usage.json` when `ticketId`
     is non-null (same content as today, only the directory changes), and
     `Docs/tickets/cost-reports/general/<name>.usage.json` when it's null.
  2. **Human-readable naming for the `general/` case.** Replace the raw
     `session_id` in the filename with a timestamp derived from the
     transcript's first entry — `summarizeUsage` in `usage-summary.ts`
     already computes `firstTimestamp` internally but doesn't expose it;
     surface it (e.g. add `firstTimestamp: number | null` to the
     `UsageSummary` return shape) so `resolveArtifactPath`'s caller can use
     it. Format as `YYYY-MM-DDTHHmmZ` (UTC), e.g. `2026-07-27T2045Z`.
  3. **Best-effort command label.** Scan the transcript for the first
     human message that looks like a slash-command invocation (a message
     whose text starts with `/`, e.g. `/morning-review`) and use its name
     (stripped of the leading `/` and any arguments) as a `--<label>`
     filename suffix, e.g. `2026-07-27T2045Z--morning-review.usage.json`.
     If no slash-command is found in the transcript, fall back to a fixed
     generic label, `chat` (e.g. `2026-07-27T2045Z--chat.usage.json`).
     This label reflects only how the session *started*, not everything
     that happened in it — note this limitation in a code comment at the
     detection site, not just here.
  4. `session_id` stays inside the JSON artifact body only (it already is
     a field there) — it must not appear in the filename for either the
     `tickets/` or `general/` case.
  5. Ensure `cost-reports/tickets/` and `cost-reports/general/` are both
     created on demand (`mkdirSync(..., { recursive: true })`, same as
     today) — no manual directory setup required.

Out of scope:
  - No change to `resolveTicketId`/`resolveActiveTicketId` or any
    attribution logic — which runs get `ticket_id: null` vs. a real id is
    unchanged, only where the resulting file lands and what it's named.
  - No change to the JSON artifact's own field shape/content
    (`artifact.ts`) — this ticket is filenames/directories only.
  - No migration of existing `Docs/tickets/cost-reports/*.usage.json`
    files already on disk into the new structure — new artifacts only;
    Alex will move the handful of existing ones by hand if he wants them
    relocated.
  - No DB-backed store, API, or dashboard — that's M-OBS.3/T-053 and
    later, explicitly deferred and unrelated to this filesystem-only fix.
  - No attempt to detect more than the *first* slash-command in a session,
    or to track every command a session ran — one best-effort label per
    artifact, not a full command history.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary
  - a unit test against a fixture transcript with `ticketId` set produces
    an artifact path under `Docs/tickets/cost-reports/tickets/T-###.usage.json`
  - a unit test against a fixture transcript with `ticketId: null` and a
    first human message of `"/morning-review\n..."` produces an artifact
    path matching
    `Docs/tickets/cost-reports/general/<timestamp>--morning-review.usage.json`
    (timestamp format asserted, e.g. via regex)
  - a unit test against a fixture transcript with `ticketId: null` and no
    slash-command in any human message produces a path matching
    `Docs/tickets/cost-reports/general/<timestamp>--chat.usage.json`
  - a unit test confirms `session_id` does not appear anywhere in either
    produced filename, while still being present in the artifact's JSON
    body

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: no milestone checkbox to flip (see Milestone ref
  above), `IMPLEMENTATION_NOTES.md` updated (new § T-063 explaining the
  split-directory/naming scheme and the "first slash-command only" label
  limitation), a `CHANGELOG.md` entry under `[Unreleased]` (tooling/dev-experience,
  not user-facing), morning report written.
