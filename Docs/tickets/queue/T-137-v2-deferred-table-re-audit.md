# T-137 — Re-audit `MILESTONES_V1_MCP.md`'s "Deferred to v2" table against current v1 shape

Milestone ref: cross-cutting audit finding (T-132, Dimension 2/5 — rules-file
  accuracy & ticket-pipeline health)

Complexity tier: S

Strategy-gate flag: no

Priority: P2

Branch: chore/m-audit/t-137-v2-deferred-table-re-audit

Context files (load ONLY these):
  - Docs/milestones/MILESTONES_V1_MCP.md § "Deferred to v2 — NOT eligible
    for any agent selection" (the table itself, and its own
    "Deployment note (2026-07)" callout beneath it)
  - Docs/milestones/MILESTONES_V2.md (what the retired PT2 items
    consolidated into)
  - .claude/rules/frontend.md § "v2-deferred surfaces stay as-is"

## Relevant background

excerpted from `Docs/milestones/MILESTONES_V1_MCP.md`, as of 2026-08-06

> This whole table predates the pivot in more than this one place and is
> due a full re-audit against the current v1 shape — not done here,
> flagged for a future pass.

That note has sat unaddressed since the deployment-note correction it's
attached to. T-132's own audit pass didn't do the full re-audit either —
it confirmed the table's existing entries are still internally consistent
(e.g. `apps/web/src/features/agent-chat/`,
`.../features/session-log/` match `frontend.md`'s "v2-deferred surfaces
stay as-is" list; `SourcesPage` matches `CLAUDE.md`'s "only kept web
surface" claim) but did not re-verify every row (4.3, 5.1–5.4, 6.1–6.3,
7.1–7.3, 8.1–8.3, 9.1/9.2/9.4/9.5/9.6, 10–19) against what's actually
shipped since the table was last edited, since that was out of this
audit's own time budget and the table's own note asks for a dedicated
pass rather than a drive-by check.

Mockup: none

Model: sonnet

Scope: Walk every row of the "Deferred to v2" table and confirm each
  numbered item still accurately describes what's deferred vs. what's
  since shipped under a v1/MCP equivalent (the table already does this
  correctly for a few rows, e.g. "6.1–6.3 ... `prep_brief` MCP tool
  (M-MCP.4) covers the v1 need" — extend that same cross-check to every
  row). Update any row whose v1-equivalent note is now stale or missing,
  and remove the "flagged for a future pass" caveat once done.

Out of scope: Re-opening any deferral decision itself (per T-132's own
  Out-of-scope note, inherited here: "No re-opening of decisions any of
  the milestone docs already closed"). This ticket only corrects
  descriptions, it doesn't un-defer anything.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean (docs-only change,
    included for consistency with TICKET_SPEC.md's standard exit shape)
  - every row in the table has been checked against current shipped
    state, with corrections applied where stale
  - the "flagged for a future pass" caveat is removed from the table's
    deployment note

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_MCP.md
  — N/A, this ticket edits that doc directly rather than checking a box
  in it, IMPLEMENTATION_NOTES.md updated only if a non-obvious judgment
  call came up, no CHANGELOG.md entry required (docs-only, no shipped
  behavior change), morning report written.
