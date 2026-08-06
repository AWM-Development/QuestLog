# T-136 — Add `knip` for automated unused-export / dead-code detection

Milestone ref: cross-cutting audit finding (T-132, Dimension 3 — dead/deprecated
  code audit)

Complexity tier: S

Strategy-gate flag: no

Priority: P2

Branch: chore/m-audit/t-136-dead-code-detection-tooling

Context files (load ONLY these):
  - package.json (root) and each app/package's package.json — for where
    `knip` and its root script would live
  - turbo.json — for wiring a new task into the existing pipeline if the
    tool should run in CI
  - apps/web/src/ (the surface T-132's manual spot-check covered, as the
    first real test case for `knip`)

## Relevant background

T-132's Dimension 3 (dead/deprecated code from the pre-pivot v2 web app)
found no genuinely orphaned code via targeted manual spot-checks (e.g.
`EmberPlaceholder.tsx` is actively wired through
`features/sources/components/import/ImportQueueItem.tsx`), but that
manual approach — grepping each file's basename against the rest of the
tree — proved unreliable (a first pass falsely flagged nearly every file
in `apps/web/src` as "possibly orphaned" due to import-path/extension
mismatches in the grep heuristic, not real dead code) and isn't something
that scales to a repo this size or that a future drift audit (`T-133`'s
`/drift-audit`) can re-run diff-scoped. Neither `knip` nor `ts-prune` is
currently installed anywhere in the repo.

**Decided (2026-08-06, Alex):** `knip`, no spike needed — skip straight to
setup rather than evaluating both.

Mockup: none

Model: sonnet

Scope: Add `knip` as a devDependency (root `package.json`, since it needs
  to see across the whole pnpm workspace to resolve cross-package
  imports correctly rather than being scoped per-package) with a root
  `knip.json`/`knip.jsonc` config covering all `apps/*`/`packages/*`
  workspaces. Add a `pnpm knip` (or `dead-code:check`) root script. Mark
  the intentionally-frozen v2 surfaces
  (`apps/web/src/features/agent-chat/`,
  `apps/web/src/features/session-log/` per `.claude/rules/frontend.md`'s
  "v2-deferred surfaces stay as-is") as `ignore` entries in the config —
  these should not be flagged just for being unreached by the v1 MCP
  surface. Run it once against the current tree and note the result
  (clean, or a short follow-up list) in the ticket's own report rather
  than filing more tickets from a first run.

Out of scope: Wiring the new tool into CI as a hard merge gate — land it
  as a manually-runnable script first; whether it becomes a CI check is a
  separate decision once Alex has seen what it actually flags.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `pnpm knip` (or the chosen script name) runs clean against the
    current tree, or its output is documented in the ticket's report
  - `knip`'s config excludes the two named v2-deferred feature
    directories from "unused" flagging

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_MCP.md
  — N/A, this is a cross-cutting audit follow-up, not a milestone task,
  IMPLEMENTATION_NOTES.md updated with what the first `knip` run found
  (clean, or what got filed from it), a CHANGELOG.md entry under
  [Unreleased], morning report written.
