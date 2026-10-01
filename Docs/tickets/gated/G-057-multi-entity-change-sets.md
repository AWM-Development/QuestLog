# G-057 — Multi-entity change sets and entity version history

Gate type: 🧠 strategy

Milestone ref: M-CHANGESET (`Docs/milestones/MILESTONES_V1_9_MCP.md`)

Opened: 2026-10-01 — by Alex/agent during planning, triaging the Ash Keep field report (`Docs/archive/FIELD_REPORT_ASH_KEEP_2026-10.md`)

Context files (load ONLY these):
  - Docs/archive/FIELD_REPORT_ASH_KEEP_2026-10.md (§ items 1–3, 5, 8; Recommendations 3 and 7)
  - packages/core/src/services/write-request.service.ts (single-tool preview/confirm: `createPreview`, `confirm`)
  - packages/mcp/src/tools/update-entity.ts, packages/mcp/src/tools/confirm-update-entity.ts (today's single-entity before/after preview)
  - packages/core/src/services/chunk-history.service.ts (the only version-history precedent today, for lore chunks rather than entities)
  - .claude/rules/mcp.md (§ write tools: preview/confirm/audit; G-001's scope)
  - Docs/tickets/gated/resolved/G-001-write-tool-preview-confirm-scope.md

Open question: Should QuestLog stage a set of edits across many entities as one reviewable unit, and keep per-entity version history? If yes, decide:
  (a) **Shape**: the unit is an ordered list of per-entity operations (create / update field / append / archive / re-parent / add or remove relationship), previewed as before/after per entity and applied atomically in one transaction. Or it's narrower (multi-entity `update_entity` only).
  (b) **Lifecycle**: whether a change set is built up over several calls and confirmed once (server-side draft with a token), or submitted whole in one call.
  (c) **Targeted edits**: whether a change set supports operations finer than a full-field overwrite (e.g. replace or remove an exact substring in `description`, with a precondition that it matches exactly once), which is what lets an agent apply "Replace X with Y in Room 1" without rewriting the room.
  (d) **History**: whether entities get an append-only revision table (one row per applied change, with change-set id), and whether a rollback tool is in v1 or history is read-only.
  (e) **Interaction with G-054**: if targeted edits land, whether the full-overwrite cap still matters.

Blocks: M-CHANGESET (`Docs/milestones/MILESTONES_V1_9_MCP.md`). There's no ticket yet. Scope depends on (a)–(e).

Notes: The field report's "decision log" (34 fixes, each tagged Add / Replace / Remove per room, checked against the chat before applying) is the manual version of this. Checking it caught a miscount and six places where the log said more than had been approved, which is the case for keeping a reviewable preview step rather than letting agents write directly. Hierarchy (T-183/T-184/T-189) shrinks the problem without solving it: a 34-fix pass still touches ~30 entities, and today that's ~30 separate preview/confirm round trips with no all-or-nothing guarantee. Recommendation 7's "rate limits queued server-side" is mostly moot. Entity writes don't embed today, so the ~25 s spacing was caution, not a requirement. That changes if `G-056` makes entity writes re-embed, so the two gates should agree on whether re-indexing happens inside or after a change set's transaction. Recommendation 2 ("sections") is deliberately *not* part of this gate. Revisit only if rooms as child entities plus targeted edits still leave a gap after the Ash Keep migration.
