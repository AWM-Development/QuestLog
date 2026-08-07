# T-040 — Portfolio polish pass

**⚠️ NOT ELIGIBLE FOR AUTONOMOUS NIGHTLY EXECUTION.** "Does this read well
to an outside reviewer" is a judgment call about audience and impression,
not something checkable by a script — same category of reasoning as
`Docs/tickets/backlog/T-017-architecture-pattern-audit.md` and
`T-039-scalability-into-v2-review.md`. A capable agent can *draft*
improvements, but Alex needs to read the result with fresh eyes before
it's real — run this interactively, or have an agent draft a PR that Alex
reviews before merging, not something that lands unreviewed overnight.

**Trigger condition:** once the rest of v1.1 (M-REMOTE, M-CICD, and
ideally M-AUDIT.2/M-AUDIT.3's findings) has landed — a portfolio pass
written against a repo that's about to change significantly under it
would need redoing.

Milestone ref: M-AUDIT.4 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Complexity tier: D

Priority: P1

Context files (load broadly):
  - README.md (root — the first thing an outside reviewer opens)
  - CLAUDE.md (accurate project description to draw from, not to copy verbatim — this file is written for an agent, not a portfolio reader)
  - Docs/PRD.md (product framing, for an accurate "what is this" summary)
  - apps/mcp-stdio/README.md (the existing, already-good example of user-facing docs in this repo — matches the tone/thoroughness to aim for elsewhere)
  - Docs/milestones/MILESTONES_V1_MCP.md, Docs/milestones/MILESTONES_V1_1_MCP.md (accurate feature/status list)

Mockup: none

Model: Fable or Opus, interactive (or draft-then-review, per banner above)

Scope:
  Produce (or draft for Alex's review) improvements covering, at minimum:

  1. **Root `README.md`** — does it exist, and does it accurately explain
     what QuestLog is (single-user AI campaign manager, MCP-first
     interface), how to run it locally, and how to connect a Claude
     client to it (both the local-stdio path from `apps/mcp-stdio/README.md`
     and, once shipped, the remote Custom Connector path from M-REMOTE)?
     A reviewer skimming for 2 minutes should understand the project's
     shape without opening a second file.
  2. **Architecture overview** — a short doc or README section describing
     the monorepo shape (`apps/server`, `apps/mcp-stdio`, `packages/core`,
     `packages/mcp`, `packages/shared`),
     the MCP-first pivot and why, and a one-paragraph explanation of the
     remote-MCP + OAuth shim design from M-REMOTE — enough for a reviewer
     to understand a real architectural decision was made deliberately,
     not defaulted into.
  3. **Demo-readiness** — a short script or checklist for showing this
     off live (or a recorded walkthrough/screenshots if live demo isn't
     practical) — connect Claude, seed a campaign, query lore, log a
     session. Doesn't need to be built here if it requires Alex actually
     recording something; drafting the script/outline is in scope, the
     recording itself may not be.
  4. **Commit history / repo hygiene spot-check** — nothing to rewrite
     (never rewrite published history), but flag anything that would read
     badly to an outside reviewer glancing at recent commits or open
     PRs (e.g. a merged PR with an embarrassing typo in the title) as a
     finding, not something to silently fix by force-pushing.

Out of scope:
  - No rewriting git history under any circumstances.
  - No removing or hiding real limitations (OCR not supported, single-user
    only, etc.) — portfolio-ready means honest and well-presented, not
    scrubbed.
  - No redesign of `Docs/DESIGN_SYSTEM.md` or anything under
    `Docs/mockups/` — this ticket is about the engineering-facing
    presentation, not visual design (and mockups are explicitly
    off-limits to modify per `CLAUDE.md`'s hard rules).

Exit condition (human-checkable):
  - Draft PR (or direct changes, if run interactively with Alex present)
    covering items 1–3 above, plus a written note on item 4's findings.
  - Alex has read through and confirmed it reads the way he wants before
    considering this done — this is explicitly a "your judgment, not the
    agent's" exit condition.

Iteration cap: not applicable (interactive/judgment-based)

Definition of done includes: checkbox flip for M-AUDIT.4 in
  `Docs/milestones/MILESTONES_V1_1_MCP.md`, no `CHANGELOG.md` entry required (this is
  documentation/presentation, not shipped application behavior), morning-
  report-equivalent is a summary of what changed and what Alex still
  needs to record/decide (e.g. the demo recording itself).
