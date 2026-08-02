# T-085 — Inline relevant IMPLEMENTATION_NOTES.md sections into ticket bodies

Milestone ref: M-EFFICIENCY.4

Priority: P0

Branch: feat/m-efficiency/t-085-inline-implementation-notes-sections

Context files (load ONLY these):
  - .claude/skills/ticket-writer/SKILL.md
  - Docs/tickets/TICKET_SPEC.md
  - Docs/IMPLEMENTATION_NOTES.md (read for its current heading/section shape — not to duplicate its content wholesale)

Mockup: none

Model: sonnet

Scope: `Docs/IMPLEMENTATION_NOTES.md` is a long, append-only, growing log (778 lines and rising) that dozens of tickets reference wholesale via `Context files:` even when only one `§` section is actually relevant — there's no line-addressable pointer, so the executor loads the entire file to find one section, and that cost recurs on every subsequent turn of the session (cache-read, not fresh compute, but still billed and still counted every turn — T-070's own run averaged ~97K tokens/turn of re-sent context). Change `ticket-writer/SKILL.md`'s step 4 drafting procedure ("Context files") so that when only a specific `§` section of `IMPLEMENTATION_NOTES.md` is relevant to a ticket (not the whole file's convention/history), the ticket-writer:
  - Pastes that section's text directly into the ticket body under a new `## Relevant background` heading (placed after `Context files:`, before `Scope:`), instead of naming the whole file as a `Context files:` entry.
  - Cites the section's exact heading and the date it was captured (e.g. "excerpted from `Docs/IMPLEMENTATION_NOTES.md` § T-069, as of 2026-07-29") so it's checkable, not silently stale — `TICKET_SPEC.md`'s field notes instruct the executor to re-check the live file only if something about the pasted excerpt looks inconsistent with what it's actually seeing in the codebase, not to trust it blindly indefinitely.
  - Still names `IMPLEMENTATION_NOTES.md` in `Context files:` as a whole-file reference for any ticket that genuinely needs multiple sections or the file's general shape — this only changes the common "exactly one section is relevant" case, not every reference to the file.
  Update `TICKET_SPEC.md` to document the new optional `## Relevant background` field (present only when a ticket excerpts background context this way) and its staleness-check expectation.

Out of scope:
  - Splitting `IMPLEMENTATION_NOTES.md` into multiple topic files — a larger structural change discussed alongside this idea but not what this ticket does; note in the report if the excerpt-and-cite approach turns out insufficient on its own and a future split is worth ticketing.
  - Retroactively rewriting any already-drafted ticket's `Context files:` entries — this only changes how `ticket-writer` drafts tickets from here forward.
  - The tier-gated process-weight change (T-084) — that's a separate concern (how much process runs once context is loaded, not what context gets loaded).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean (no runtime code touched — confirms no regression)
  - `grep` against `ticket-writer/SKILL.md` confirms its drafting procedure instructs pasting a relevant `IMPLEMENTATION_NOTES.md` section directly into the ticket body under `## Relevant background`, with a section-heading + date citation, rather than defaulting to a whole-file `Context files:` reference when only one section applies
  - `grep` against `TICKET_SPEC.md` confirms the new `## Relevant background` field is documented, including the staleness-check instruction
  - Applying the new procedure to a real historical example (e.g. drafting a mock ticket that would reference T-069's worktree-convention section) demonstrably excerpts only that section, not the whole file — pasted into the report as a concrete verification artifact, not just described

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
