# T-146 — `/lineup`: milestone progress + deployed version tracking

Milestone ref: M-EFFICIENCY.21

Complexity tier: D

Strategy-gate flag: no

Priority: P1

Branch: feat/m-efficiency/t-146-lineup-milestone-progress-deployed-version

Context files (load ONLY these):
  - .claude/commands/lineup.md
  - Docs/tickets/LINEUP_SAMPLE.md
  - AGENTS.md (task-source line — enumerates milestone docs and marks each shipped/in-progress; this is the source of truth for what counts as "completed" vs. "next in queue")
  - CHANGELOG.md (dated version-section convention, and the `[Unreleased]` → cut-on-promote mechanic)
  - package.json (root `version` field — the only one that tracks real releases, per `CHANGELOG.md`'s own header note)
  - Docs/milestones/MILESTONES_V1_MCP.md (the one fully-shipped milestone doc — header/status convention to model "completed" against)
  - Docs/milestones/MILESTONES_V1_1_MCP.md (an in-progress milestone doc with real `[ ]`/`[x]` task checkboxes — model the "remaining tasks" scan against this one)

Mockup: none

Model: sonnet

Scope: Add a new report section to `/lineup`, named **"📈 Milestone Progress & Deployed Version"**, positioned directly after the existing "⚾ At Bat / On Deck / In the Hole" section and before "🔍 Open PRs Awaiting Review" (`.claude/commands/lineup.md`'s Output template gets a new fixed block in this slot — same "canonical output shape" discipline the rest of the template already follows). The new section has three parts, in order:

1. **Completed milestones** — one line per milestone doc `AGENTS.md`'s task-source line marks as shipped (today: only `MILESTONES_V1_MCP.md`, tagged "v1, shipped"). Format: `**v1 — <one-line description>**`, where the one-liner is drawn from the doc's own opening description (e.g. `MILESTONES_V1_MCP.md`'s "v1's primary interface is an MCP server..." sentence), trimmed to a single sentence — not the full "Why vX exists" prose block. If more than one shipped doc exists in the future, list them oldest-first, one line each.

2. **Currently deployed version** — read `package.json`'s `version` field off `origin/main` (not `develop` — this must reflect what's actually live, following the same "never read the shared primary directory's live state" discipline `/lineup`'s own Step 1 already uses for ticket files, e.g. `git show origin/main:package.json`). Cross-reference `CHANGELOG.md`'s dated section header for that exact version (`## [X.Y.Z] - YYYY-MM-DD`, read off `origin/main`'s `CHANGELOG.md` for the same reason) to report the promotion date. Render as: `**Deployed: vX.Y.Z** · promoted to \`main\` <YYYY-MM-DD>` — if no dated section is found for the version on `main` (shouldn't happen given the `CHANGELOG.md` obligation, but the template must not silently omit the line), fall back to reporting the version alone with an explicit "promotion date not found in `CHANGELOG.md`" note rather than a blank field.

3. **Next milestone in queue** — the first milestone doc `AGENTS.md`'s task-source line marks as "in progress" (following the doc's own listed order, e.g. `MILESTONES_V1_1_MCP.md` before `MILESTONES_V1_2_MCP.md`), name it (e.g. "v1.1 — Remote MCP"), and list its remaining `[ ]` top-level tasks by milestone-task id and title (e.g. `M-REMOTE.3 — ...`), reusing `.claude/skills/ticket-writer/SKILL.md`'s own "what's next" mode logic (skip `[x]` and skip nothing else — a ticketed-but-unstarted `[ ]` task still counts as remaining) rather than inventing new scan logic. If every task across every "in progress" doc is checked off, report that explicitly ("no remaining tasks in any in-progress milestone doc") instead of an empty list.

Update `Docs/tickets/LINEUP_SAMPLE.md` with a worked example of this new section, using real repo data as of this ticket's drafting (2026-08-07) so the sample is checkable against the actual repo state at that point in time, consistent with the rest of that file's "illustrative, point-in-time" convention.

Out of scope:
  - Any other existing section of `/lineup`'s output (At Bat/On Deck/In the Hole, Open PRs, Backlog Snapshot) — untouched.
  - Surfacing this data in the observability dashboard (`M-OBS`) — this is a `/lineup`-only, text-report addition.
  - Any cost/token/duration metrics per milestone — this section is pure ticket-checkbox and version-string reporting, nothing from the observability store.
  - Backfilling a permanent "shipped milestones" record anywhere — the section is computed fresh from `origin/main`/`origin/develop` state on every `/lineup` run, same as every other section.
  - Changing `AGENTS.md`'s task-source line itself, or the shipped/in-progress markers on it.
  - Handling more than one "next in progress" milestone doc in the same report — only the first (per `AGENTS.md`'s listed order) is surfaced, matching how `ticket-writer`'s "what's next" mode already picks a single doc rather than merging several.

Exit condition (machine-checkable):
  - `.claude/commands/lineup.md`'s Output template contains the new "📈 Milestone Progress & Deployed Version" section, in the specified position, with concrete field placeholders for all three parts (completed-milestone one-liners, deployed version + promotion date, next milestone + remaining tasks) — reviewable by diff against the current template.
  - `.claude/commands/lineup.md`'s procedure section gains the corresponding numbered step(s) describing exactly how each of the three parts is derived (which branch/file each read comes from, and which existing scan logic — `ticket-writer`'s "what's next" mode — the remaining-tasks list reuses), matching the specificity of the command's existing steps.
  - `Docs/tickets/LINEUP_SAMPLE.md` is updated with a worked example of the new section populated with real data as of 2026-08-07: completed milestones lists `v1` with its one-liner; deployed version reads `1.1.1` with promotion date `2026-08-02` (per `CHANGELOG.md`'s `## [1.1.1] - 2026-08-02` header, cross-checked against `origin/main`'s `package.json` `version` field); next milestone identifies whichever doc `AGENTS.md`'s task-source line marks first "in progress" as of that date, with its actual `[ ]` tasks listed by id/title.
  - `pnpm lint && pnpm typecheck && pnpm test` all pass with no regressions (D-tier: a single end-of-work `scripts/run-tests-quiet.sh` pass is sufficient, no per-checkpoint TDD loop required, per `TICKET_SPEC.md`'s D-tier rubric).

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
