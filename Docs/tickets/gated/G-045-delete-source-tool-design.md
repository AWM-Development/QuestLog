# G-045 — `delete_source` tool design

Gate type: 🧠 strategy

Milestone ref: M-BUG.5 (`Docs/milestones/MILESTONES_BUGS.md`)

Opened: 2026-08-19 — by Alex/agent during planning, while ticketing follow-ups to T-159 (`ingest_text` silently succeeding while returning an error to the caller)

Context files (load ONLY these):
  - Docs/tickets/queue/T-159-ingest-text-error-response-after-partial-success.md (the bug whose duplicate-source cleanup this gate follows up on — no `delete_source` tool existed, so the workaround was `correct_lore`/`confirm_correct_lore` superseding the duplicates' chunks rather than removing the source rows)
  - Docs/tickets/queue/T-160-list-sources-mcp-tool.md (the sibling, already-ungated ticket this gate's eventual ticket will pair with — `list_sources` makes duplicates discoverable; `delete_source` is what actually removes them)
  - .claude/rules/mcp.md (§ "Write tools — preview/confirm/audit applies to mutations of existing data, not additive-only writes" — deleting an existing source is a mutation, not an additive write, so G-001's preview/confirm rule presumptively applies; this gate exists to confirm that and work out the mechanics, not to relitigate G-001 itself)
  - packages/core/src/services/entity.service.ts (`attributes.seededFrom.chunkIds`, set by `createSeeded` — one concrete way an entity can already reference a source's chunks by id, relevant to "what breaks if the source is deleted")
  - packages/core/src/services/chunking.service.ts and packages/core/src/db/schema (chunk/source schema shape — what a delete would need to cascade or supersede)

Open question: When `delete_source` removes a source, what happens to (a) its chunks — hard-delete, or mark `superseded` the same way `correct_lore` already does for corrections — and (b) any entity that cites the source (via `citations`/`attributes.seededFrom.chunkIds`) or was created from it (`ingest_entities`' `sourceId` attribution)? And does the tool go through preview/confirm (per `.claude/rules/mcp.md`'s G-001 mutation rule), or is there a narrower justification for treating it as a quick-action tool instead (the `G-023` carve-out `.claude/rules/mcp.md` documents for the inventory tools)?

Blocks: M-BUG.5 (`Docs/milestones/MILESTONES_BUGS.md`) — no ticket has been drafted for `delete_source`; `Scope` can't honestly be written until this question resolves. The milestone task carries `(Gated on: G-045)` in place of a ticket id.

Notes: Raised alongside G-046 (`ingest_text` idempotency-key strategy) as a follow-up to T-159's bug report, which suggested both a `delete_source` tool and idempotency keys as hardening against the same duplicate-source failure mode. Filed as two separate gates rather than one combined gate — each needs its own single answerable question, and they don't share a resolution (delete-time chunk/citation handling vs. request-dedup semantics are unrelated decisions). No options have been pre-explored yet; this is a cold-open gate for `/ungate` to work through with Alex from scratch.
