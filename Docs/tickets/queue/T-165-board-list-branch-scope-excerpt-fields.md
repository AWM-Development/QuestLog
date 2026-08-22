# T-165 — board.list: add branch + scope-excerpt fields

Milestone ref: M-OBS.9

Complexity tier: S

Strategy-gate flag: no

Priority: P1

Branch: feat/m-obs/t-165-board-list-branch-scope-excerpt-fields

Context files (load ONLY these):
  - packages/core/src/services/board.service.ts (`parseTicketFile` — the function this ticket extends; `matchField()` is the exact precedent pattern to reuse for `Branch`)
  - packages/core/src/services/board.service.test.ts (existing fixture-based test shape to extend)
  - packages/shared/src/validators/board.ts (`TicketCardSchema` — the output shape this ticket adds two fields to)
  - Docs/tickets/backlog/T-158-observability-dashboard-board-view.md (the consumer this unblocks — its details modal needs both fields)
  - Docs/tickets/gated/resolved/G-043-ticket-board-visual-design.md § Resolution (records why this was split out instead of reopening the already-merged T-157)

Mockup: Docs/mockups/board/ (reference only — this ticket has no UI of its own; the mockup's ticket-details modal is what these two fields feed)

Runner: claude-code

Model: sonnet

Scope: Extend `board.list`'s already-shipped output (`packages/core/src/services/board.service.ts`, `packages/shared/src/validators/board.ts`) with two fields `T-157` didn't include:
  - `branch: string | null` — parsed via `matchField(content, "Branch")`, the exact same helper/pattern `parseTicketFile` already uses for `Priority`/`Complexity tier`/`Blocked on`/`Gated on`. `null` when the ticket file has no `Branch:` line (gate-stubs, and any ticket predating the field).
  - `scopeExcerpt: string | null` — derived from the `Scope:` field's content: take up to the first 160 characters, cut at the nearest preceding word boundary, append `…` if truncated. `null` when there's no `Scope:` field (gate-stubs). Needs a small helper alongside `matchField` (the `Scope:` field's value runs until the next top-level field or section, not to end-of-line, so it isn't a single-regex `matchField` call) — keep it a pure function next to `parseTicketFile`, same file.
  - Add both to `TicketCardSchema` (`packages/shared/src/validators/board.ts`) as `z.string().nullable()`.
  - No router (`board.ts`) or caching changes — `parseTicketFile`'s return shape is the only thing changing; the TTL-cached fetch/list plumbing around it is untouched.

Out of scope:
  - No change to `board.list`'s query signature, caching behavior, or the six-status derivation logic.
  - No UI — `T-158` is the consumer.
  - No retroactive backfill of `Branch:` onto ticket files that don't have it (`M-BUG.5`-style entries in `gated/` referenced from the board, if any, stay `branch: null`).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `parseTicketFile` against a fixture ticket file with both `Branch:` and a multi-sentence `Scope:` returns the expected `branch` and a `scopeExcerpt` truncated at the 160-char/word-boundary rule with a trailing `…`
  - a fixture ticket file with a `Scope:` under 160 characters returns the full text in `scopeExcerpt`, no trailing `…`
  - a fixture gate-stub (no `Branch:`, no `Scope:`) returns `branch: null` and `scopeExcerpt: null`
  - `TicketCardSchema` accepts the new fields; existing fixture-based `board.service.test.ts`/`board.test.ts` cases from `T-157` still pass unmodified except for the two new fields appearing in expected output

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
