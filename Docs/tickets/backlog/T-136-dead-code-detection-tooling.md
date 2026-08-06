# T-136 — Add automated unused-export / dead-code detection tooling

Milestone ref: cross-cutting audit finding (T-132, Dimension 3 — dead/deprecated
  code audit)

Complexity tier: S

Strategy-gate flag: no

Priority: P2

Branch: chore/m-audit/t-136-dead-code-detection-tooling

Context files (load ONLY these):
  - package.json (root) and each app/package's package.json — for where a
    `knip`/`ts-prune`-equivalent script and its config would live
  - turbo.json — for wiring a new task into the existing pipeline if the
    tool should run in CI
  - apps/web/src/ (the surface T-132's manual spot-check covered, as the
    first real test case for whatever tool this ticket adds)

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

Mockup: none

Model: sonnet

Scope: Evaluate and add one dead-code/unused-export detection tool
  (`knip` is the more actively maintained option as of this writing;
  `ts-prune` is the lighter-weight alternative — pick based on a quick
  spike against this monorepo's actual turbo/pnpm workspace shape) as a
  `pnpm` script, configured to respect the intentionally-frozen v2
  surfaces (`apps/web/src/features/agent-chat/`,
  `apps/web/src/features/session-log/` per `.claude/rules/frontend.md`'s
  "v2-deferred surfaces stay as-is" — these should not be flagged just for
  being unreached by the v1 MCP surface). Run it once against the current
  tree and note the result (clean, or a short follow-up list) in the
  ticket's own report rather than filing more tickets from a first run.

Out of scope: Wiring the new tool into CI as a hard merge gate — land it
  as a manually-runnable script first; whether it becomes a CI check is a
  separate decision once Alex has seen what it actually flags.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `pnpm <tool>:check` (or equivalent) runs clean against the current
    tree, or its output is documented in the ticket's report
  - the chosen tool's config excludes the two named v2-deferred feature
    directories from "unused" flagging

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_MCP.md
  if applicable (likely N/A — mark N/A if so), IMPLEMENTATION_NOTES.md
  updated with the tool choice and why, a CHANGELOG.md entry under
  [Unreleased], morning report written.
