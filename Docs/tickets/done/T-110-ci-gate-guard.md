# T-110 — CI gate guard: fail a PR whose ticket carries an unresolved `Gated on:`/unmet `Blocked on:`

Milestone ref: M-PIPELINE.14 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P0

Branch: feat/m-pipeline/t-110-ci-gate-guard

Context files (load ONLY these):
  - .github/workflows/ci.yml (the Doc-Sync/Migration-Guard/Mockup-Guard jobs
    are the reference shape for a new PR-only guard job)
  - Docs/tickets/TICKET_SPEC.md § "Gated on"/"Blocked on" field notes
  - Docs/tickets/GATE_SPEC.md
  - Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Resolution (Q2)

## Relevant background
excerpted from `Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md` § Open question, as of 2026-08-02

**Q2 — Instruction → invariant.** ... a gate guard (fail any ticket PR whose
ticket carries an unresolved `Gated on:`, or whose `Blocked on:`
prerequisites aren't in `done/`) ... Decide which of these are worth
building, whether they're required status checks on `develop`, and whether
the same logic also runs as a pre-flight so a run fails early rather than at
PR time. Resolved: build all candidates; this is the cheapest and
highest-value one, and the exact failure mode (a skipped strategy-review
stop) the investigation session that opened this gate found live.

Mockup: none

Model: sonnet

Scope: Add a new PR-only job to `.github/workflows/ci.yml` (same
  `if: github.event_name == 'pull_request'` shape as `doc-sync`/
  `migration-guard`/`mockup-guard`): identify every ticket file the PR's
  diff touches under `Docs/tickets/{queue,backlog,in-progress,done}/` (a
  ticket file being *added or modified* by this PR, not every ticket file
  in the repo), parse each one's `Gated on:`/`Blocked on:` fields, and fail
  the job if: (a) a `Gated on: G-###` line is present and
  `Docs/tickets/gated/G-###-*.md` still exists (i.e. unresolved — if it's
  moved to `gated/resolved/` the reference is stale per `GATE_SPEC.md`'s
  sync-bug case, which this job should also flag, separately, as a warning
  not a hard fail); or (b) a `Blocked on: T-###` line is present and that
  ticket id has no file under `Docs/tickets/done/`. A ticket file the PR is
  *moving into* `queue/`/`done/` (a normal promotion) is exempt from its own
  historical `Blocked on:`/`Gated on:` line only once that line has actually
  been deleted as part of the same diff — the check is about the file's
  state as it lands, not its prior state. Write this as a small standalone
  script (`scripts/ci-gate-guard.sh` or `.mjs`, whichever matches the
  existing guard jobs' style) so it's directly reusable by `T-115`'s
  pre-flight wiring rather than logic embedded only in the workflow YAML.

Out of scope: The scope guard (`T-111`), report-completeness (`T-112`),
  exit-condition recomputation (`T-113`), red-check (`T-114`) — each is its
  own ticket. Wiring this into the executor's own pre-flight (`T-115`,
  blocked on this ticket landing first) — this ticket only adds the CI job
  and the reusable script it's built on.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `pnpm turbo lint`/the new script itself has a test/fixture pass: a
    synthetic PR diff introducing a ticket with an unresolved `Gated on:`
    fails the check; the same ticket with the `Gated on:` line removed
    passes
  - a synthetic PR diff introducing a ticket with `Blocked on: T-999` (no
    such ticket in `done/`) fails; naming a real `done/` ticket id passes
  - the new job is added to branch protection's required status checks on
    `develop` (documented in the report if this requires a manual GitHub
    settings change outside the diff itself, per the sandbox's known
    limitations)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
