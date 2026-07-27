# T-049 — Batch ticket context-file reads into one turn

Milestone ref: M-EFFICIENCY.2

Priority: P0

Branch: feat/m-efficiency/t-049-batch-context-file-reads

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md

Mockup: none

Model: sonnet

Scope: `EXECUTOR_ROUTINE.md` Step 3 ("Load context — ONLY what the ticket names") instructs reading `CLAUDE.md` plus every file in the ticket's `Context files:` field, but says nothing about *how many turns* that should take. A model is free to (and in practice does) read them one at a time across sequential turns — each of which re-sends the entire growing conversation to that point. Claude's API supports multiple tool calls in a single assistant turn, executed together; since a ticket's full Context files list is always known upfront (that's the point of the field), there's no reason to spread those reads across turns. Update Step 3 to explicitly instruct: read `CLAUDE.md` and every file in `Context files:` as parallel tool calls within a single assistant turn, not sequentially across multiple turns. Keep the existing "if you discover mid-ticket that something is missing, note it as a scoping gap" language unchanged — that's a legitimately sequential follow-up read, not part of this batching instruction.

Out of scope:
  - No change to *which* files get read (the Context files field itself, `.claude/rules/*.md` auto-loading, or the Mockup-path read) — only the number of turns it takes to read the known set.
  - No enforcement mechanism (e.g. a hook that blocks sequential reads) — this is a routine-instruction change; verifying the executor actually follows it in practice is an observation to make via T-046/T-047's data once that ships, not something to build here.
  - No change to Step 4's TDD loop, which necessarily reads/writes files sequentially as work proceeds — this ticket only concerns the upfront context-loading step.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean (no code touched by this ticket; confirms no regression)
  - `grep` against `Docs/tickets/EXECUTOR_ROUTINE.md` Step 3 confirms it explicitly instructs single-turn/parallel reads for the Context files list (not just "read these files")

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
