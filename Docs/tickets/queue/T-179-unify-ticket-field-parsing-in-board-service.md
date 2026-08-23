# T-179 — Unify ticket-field parsing in board.service.ts

Milestone ref: M-OBS.9 (Docs/milestones/MILESTONES_V1_2_MCP.md)

Complexity tier: S

Strategy-gate flag: no

Priority: P2

Branch: feat/m-obs/t-179-unify-ticket-field-parsing

Context files (load ONLY these):
  - packages/core/src/services/board.service.ts (`matchField` and `extractScopeExcerpt` — the two parsing paths this ticket unifies)
  - packages/core/src/services/board.service.test.ts (existing fixture-based tests for both functions — the source of truth for behavior that must not change)

Scope: `matchField` (single-line fields: `Priority`, `Complexity tier`, `Blocked on`, `Gated on`, `Branch`) and `extractScopeExcerpt` (T-165's multi-line `Scope:` extraction) are two separate parsing strategies over the same ticket-file text, and `extractScopeExcerpt`'s "where does this field's value end" boundary check is a shape-based heuristic regex (`/\n[A-Z][\w /-]*(?:\s*\([^)]*\))?:/` — "a line starting with a capital letter and ending in a colon") rather than a check against the ticket format's actual known field set. That heuristic can misfire: if a `Scope:` field's prose ever contains a hard-wrapped line that itself looks like `Capitalized Word:` at column 0 (e.g. "...handle this case.\nNote: fall back to null."), the regex mistakes it for the next field and silently truncates the excerpt early, with no error — see `Docs/tickets/done/T-165-board-list-branch-scope-excerpt-fields.md`'s report/review discussion.

Replace the shape-based boundary heuristic with an explicit allowlist of `TICKET_SPEC.md`'s actual top-level field names (`Blocked on`, `Complexity tier`, `Context files`, `Definition of done includes`, `Gated on`, `Iteration cap`, `Milestone ref`, `Mockup`, `Model`, `Out of scope`, `Priority`, `Runner`, `Strategy-gate flag`) — a boundary match only fires on one of these literal names, never on any capitalized-word-plus-colon shape. This flips the failure mode from "silently truncates on a false-positive match" to "safely runs to end-of-file if the allowlist is ever missing a real field" — a visibly wrong (too long) result instead of a silently wrong (too short) one.

Beyond the immediate fix, unify the two parsing strategies into one pass: a single `parseAllFields(content)` helper that walks the ticket file once and returns every field's full value (single- or multi-line, using the same allowlist-bounded extraction) keyed by field name, so `matchField`'s single-line regex and the multi-line `Scope:` extraction stop being two different mechanisms for what is conceptually the same operation. `parseTicketFile` reads from this one map instead of calling `matchField` per field plus `extractScopeExcerpt` separately.

Out of scope:
  - No change to `TicketCardSchema`, `board.list`'s router/caching, or the six-status derivation logic (`deriveStatus`) — only the internal field-extraction mechanism inside `parseTicketFile` changes.
  - No change to `SCOPE_EXCERPT_MAX_LENGTH`'s value or the 160-char/word-boundary truncation math — that logic is correct as-is and untouched by this ticket.
  - No retroactive re-validation of already-ingested ticket files — this is a parsing-correctness fix for future/edge-case input, not a data-repair pass.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - existing fixture-based `board.service.test.ts` cases (`Branch`/`Priority`/`Complexity tier`/`Blocked on`/`Gated on`/`Scope` extraction, including T-165's long-Scope/short-Scope/no-Branch-no-Scope cases) all still pass unmodified, proving the unification is behavior-preserving
  - a new fixture whose `Scope:` prose contains a hard-wrapped line matching the old heuristic's false-positive shape (e.g. a line reading `Note: something.` at column 0 inside the Scope text) returns a `scopeExcerpt` that includes that line's text rather than truncating before it — the regression case this ticket exists to fix
  - `apps/server/src/routers/board.test.ts`'s existing fixture-based assertions still pass unmodified

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
