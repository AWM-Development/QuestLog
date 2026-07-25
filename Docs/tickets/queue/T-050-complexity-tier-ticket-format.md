# T-050 — Complexity tier + strategy-gate flag on the ticket format

Milestone ref: M-OBS.6

Branch: feat/m-obs/t-050-complexity-tier-ticket-format

Context files (load ONLY these):
  - Docs/tickets/TICKET_SPEC.md
  - .claude/skills/ticket-writer/SKILL.md
  - Docs/tickets/REPORT_TEMPLATE.md
  - Docs/tickets/EXECUTOR_ROUTINE.md

Mockup: none

Model: sonnet

Scope: Every other metric this observability system captures (tokens, cost, duration) is only interpretable relative to how big the ticket actually was — a flat average across a 1-file config fix and a 161-file monorepo split is meaningless. Add two new fields to `TICKET_SPEC.md`'s fixed ticket format, placed directly under `Milestone ref:`:
  - `Complexity tier: S | M | L` — a rubric, not a vibe: **S** = single file or function, an established pattern already used elsewhere in the codebase; **M** = multiple files, a new service/router pair, or a moderate refactor, still within a well-understood pattern; **L** = a new subsystem, a cross-cutting change touching many files, or a genuinely unfamiliar pattern for this codebase. Document this rubric in `TICKET_SPEC.md` itself so it's not left to individual judgment each time.
  - `Strategy-gate flag: yes | no` — whether this ticket's own scope only became draftable after resolving a 🎨/🧠 gate (i.e. it previously existed as a `Gated on:` reference, or was drafted directly by `/ungate`). Purely a provenance marker — distinguishes "routine ticket" from "ticket that required a real decision to exist."
  Update `.claude/skills/ticket-writer/SKILL.md`'s drafting procedure (step 4, "fill out every field") to assign both fields on every future ticket. Update `REPORT_TEMPLATE.md` and `EXECUTOR_ROUTINE.md` Step 7 so the final report echoes the ticket's tier and flag — this is what lets whatever eventually ingests report data (M-OBS.3, once G-003 resolves) carry the tier through without a separate lookup.

Out of scope:
  - Retroactively tagging already-`done`/`archive`d tickets (~45 so far as of this writing) with a tier — a separate decision on whether that backfill is worth doing by hand or estimating from shipped diff size. This ticket only covers tickets drafted from here forward.
  - No DB/API/dashboard changes — those are M-OBS.3/M-OBS.4/M-OBS.5, gated on G-003, and will consume this field once it exists in report data.
  - No changes to `/ungate`'s own procedure beyond what's implied by ticket-writer's — `/ungate` already follows `TICKET_SPEC.md` "exactly, same as ticket-writer would" per `GATE_SPEC.md`, so the new fields apply there automatically once `TICKET_SPEC.md` is updated.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean (no runtime code touched; confirms no regression)
  - `grep` against `TICKET_SPEC.md` confirms both new fields are present in the documented ticket shape, with the S/M/L rubric spelled out
  - `grep` against `.claude/skills/ticket-writer/SKILL.md` confirms its drafting procedure instructs assigning both fields
  - `grep` against `REPORT_TEMPLATE.md` and `EXECUTOR_ROUTINE.md` confirms the report step references echoing the ticket's tier/flag

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
