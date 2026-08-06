# T-126 — Repo hygiene audit command

Milestone ref: M-EFFICIENCY.14

Complexity tier: S

Strategy-gate flag: no

Priority: P2

Blocked on: T-095 — must be merged into develop first

Branch: feat/m-efficiency/t-126-repo-hygiene-audit-command

Context files (load ONLY these):
  - .gitignore (confirm which of `.turbo/`, `dist/`, `tmp/worktrees/` are already gitignored vs. tracked)
  - Docs/tickets/reports/T-117-github-actions-lean-audit.md (precedent for the keep/consolidate/remove finding format this command's report output should follow)
  - Docs/tickets/done/T-046-executor-usage-capture-hook.md (shape and location of the `*.usage.json` artifacts under `Docs/tickets/cost-reports/`)
  - Docs/tickets/done/T-053-observability-store-schema-ingestion.md (confirms no historical backfill exists — the audit must not assume old files are already in the store)
  - Docs/tickets/queue/T-095-wire-observability-ingestion-into-executor-routine.md (once merged: confirms live ingestion is real before recommending file removal)
  - Docs/tickets/COMMANDS.md (convention for documenting a new pipeline command)
  - .claude/commands/command-help.md (existing command file shape to mirror for a new `.claude/commands/repo-audit.md`)

Mockup: none

Model: sonnet

Scope: A re-runnable audit command (`.claude/commands/repo-audit.md`, backed by a script under `scripts/`) covering two distinct kinds of accumulating junk:
  1. **Local, gitignored build/cache artifacts** — reports disk usage for `.turbo/` (root + each workspace package's own `.turbo/`), `dist/`, and any `tmp/worktrees/` entries whose branch has already merged into `develop` (per the merge ledger from T-116, `Docs/tickets/.merge-ledger.json`, or a live check if the ledger doesn't cover it) or no longer exists on the remote. Supports a `--clean` flag that safely removes only these regenerable, already-gitignored paths — never anything tracked in git.
  2. **Tracked files that look like accumulating generated/derived data** — a report-only pass (no `--clean` path; deletion of tracked history is Alex's call, not the command's) flagging candidates by name, following T-117's `keep | consolidate | remove | tighten` tagging convention. Must explicitly evaluate and name `Docs/tickets/cost-reports/*.usage.json`: confirm (by this point, T-095 has merged) that live ingestion into the observability store is wired in, note that historical files still have no backfill path into the store (per T-053's explicit out-of-scope), and tag the finding accordingly — e.g. `remove` once backfilled, or `keep-until-backfilled` if backfill hasn't happened, rather than assuming removal is already safe.
  - Command output format mirrors T-117's audit doc shape (numbered findings, summary punch list table) but is produced by running the command, not hand-written — so a future run reflects current repo state rather than a stale one-time snapshot.
  - `Docs/tickets/COMMANDS.md` gets a new entry describing the command per that file's existing convention.

Out of scope:
  - No automatic deletion or gitignoring of any tracked file — `Docs/tickets/cost-reports/` and any other tracked-file finding are reported only; acting on a report-only finding is a separate, later decision (a follow-up ticket or a direct Alex-authored change, same pattern T-117 → T-120–124 followed).
  - No backfill of historical `*.usage.json` files into the observability store — that's a distinct, already-named gap from T-053, not silently bundled into this ticket's scope.
  - No CI workflow integration (e.g. running this on a schedule or failing a PR on findings) — this is a manually-invoked command for now, not an enforcement gate.
  - No changes to `.gitignore` itself, even if the audit finds a path that arguably should be added — name it as a finding, don't act on it.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - running the command against this repo's current state produces a report that lists `.turbo/` and any stale `tmp/worktrees/` entries under the local-artifact section, and explicitly evaluates `Docs/tickets/cost-reports/` under the tracked-files section with a stated tag
  - `--clean` against a fixture directory tree (a scratch copy, not the real repo) removes only the gitignored artifact paths and leaves every tracked-equivalent path untouched — asserted directly, not just described

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
