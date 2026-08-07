# T-107 — Generalize `TICKET_SPEC.md`'s `Model:` field to `Runner:` + `Model:`

Milestone ref: M-PIPELINE.11 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Complexity tier: D

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-pipeline/t-107-ticket-spec-runner-field

Context files (load ONLY these):
  - Docs/tickets/TICKET_SPEC.md
  - .claude/skills/ticket-writer/SKILL.md
  - Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Resolution (Q1)

## Relevant background
excerpted from `Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md` § Resolution, as of 2026-08-02

Q1(b) decided: yes, `TICKET_SPEC.md`'s `Model: sonnet` field generalizes to a
runner+model selection. Every ticket drafted today implicitly assumes
`Runner: claude-code` — this ticket makes that explicit and gives
`ticket-writer` (and a future `/ungate` drafting a ticket for a non-Claude
run) a field to actually set. `Model:` stays meaningful only when
`Runner: claude-code`; a `Runner: devin` ticket omits it or marks it N/A,
since model selection is Cognition's concern, not this pipeline's.

Mockup: none

Model: sonnet

Scope: Add a `Runner: claude-code | devin` field to `TICKET_SPEC.md`'s fixed
  format, immediately before the existing `Model: sonnet` line — default
  `claude-code` (every ticket drafted before a second runner exists gets
  this value). Field notes: `Runner:` names which agent executes the
  ticket; `Model:` only applies when `Runner: claude-code` and stays fixed
  at `sonnet` per the existing rule ("never opus/fable for execution").
  Update `ticket-writer`'s field-filling step to set `Runner: claude-code`
  by default, same confirmation discipline as `Priority` (propose, don't
  silently assume, though in practice this stays `claude-code` until a
  second runner is actually wired). Update every existing ticket file this
  ticket touches for a fixture/example purpose only if `TICKET_SPEC.md`
  itself quotes one — do not retroactively edit the ~104 already-drafted
  ticket files under `Docs/tickets/{queue,backlog,in-progress,done,blocked,
  archive}/`, since none of them predate a real `Runner:` distinction
  existing and retrofitting them is unbounded scope for zero behavioral
  value.

Out of scope: Any change to `EXECUTOR_ROUTINE.md`'s Step 1 selection logic
  to actually filter by `Runner:` — no second runner exists yet to filter
  for, so this stays a documented-but-inert field until `T-109`'s adapter
  and a real second-runner ticket both land. Retrofitting existing tickets
  (see Scope).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `TICKET_SPEC.md`'s format block shows `Runner:` immediately before
    `Model:`, with a field note explaining the `claude-code`/`devin`
    values and the "Model only applies when Runner: claude-code" rule
  - `ticket-writer/SKILL.md`'s field-filling step (step 4) lists `Runner`
    alongside `Model` with the same "always claude-code today" default

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
