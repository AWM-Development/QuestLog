# G-055 — Typed entity relationships in v1 (connections, properties, structural validation)

Gate type: 🧠 strategy

Milestone ref: M-ENTITYGRAPH (`Docs/milestones/MILESTONES_V1_9_MCP.md`)

Opened: 2026-10-01 — by Alex/agent during planning, triaging the Ash Keep field report (`Docs/archive/FIELD_REPORT_ASH_KEEP_2026-10.md`)

Context files (load ONLY these):
  - Docs/archive/FIELD_REPORT_ASH_KEEP_2026-10.md (§ items 6–7, Recommendations 1 and 6, "Useful as a test case")
  - packages/core/src/db/schema/tables.ts (`entityRelationships`: defined, migrated, unused by any service or tool; `entities.linkedEntityId` for the T-171 structural-pairing precedent)
  - Docs/tickets/gated/resolved/G-053-composable-sub-entities.md (Resolution §1: why containment went to a dedicated `parentEntityId` column and *not* `entity_relationships`)
  - Docs/tickets/gated/resolved/G-006-entity-delete-archive-semantics.md (relationship rows keep resolving against an archived entity; no cascade)
  - Docs/milestones/MILESTONES_V2.md § 5.2 (the existing v2 plan for relationship CRUD and graph traversal, framed as web-app work)
  - .claude/rules/mcp.md (§ write tools: preview/confirm for mutations vs. direct additive writes)

Open question: Should agents be able to create and query typed relationships between entities through MCP in v1, rather than waiting for v2's web UI? The motivating case is room connections in a dungeon: a doorway, stairs or a secret passage, with properties like `locked_by` (another entity), `one_way` and `hidden` + DC. If yes, decide:
  (a) **Storage**: extend `entity_relationships` (add a jsonb `properties` column, and decide whether `label` is freeform or a controlled vocabulary such as `connects_to` / `governed_by` / `member_of`), or a dedicated table for spatial connections.
  (b) **Direction**: how a two-way doorway vs. a one-way drop is represented (one row with a `bidirectional` flag, or two rows).
  (c) **MCP surface**: which tools (e.g. `add_relationship`, `remove_relationship`, plus relationships returned by `get_entity` or a `list_relationships`), and which go through preview/confirm under `.claude/rules/mcp.md` (adding is additive; removing mutates).
  (d) **Structural validation**: whether to ship a read-only check scoped to one parent's subtree that reports structural defects. What it checks: a child with no inbound connection, a connection that contradicts another, a connection to an entity in a different subtree, and a reference to an archived entity.
  (e) **Rule references**: whether "this room is Heat: Exposed" is a relationship to a `rule` entity (T-190) with a property, or a structured `attributes` value that names the rule entity's id.

Blocks: M-ENTITYGRAPH (`Docs/milestones/MILESTONES_V1_9_MCP.md`). There's no ticket yet. Scope depends on (a)–(e).

Notes: G-053 deliberately kept containment (parent → child) out of `entity_relationships`, so this gate is only about *non-containment* edges and shouldn't re-open that. Acceptance case proposed by the field report: after migration, the structural check should report Ash Keep's four known contradictions (entrance hall with no exit to the adjacent main hall; an upper room with no way in; three basement rooms disagreeing about connections; a floor collapse into an unspecified basement room that bypasses a key-locked door). Out of this gate: auto-suggesting relationships from co-occurrence in session text, and any visual map. Both stay v2 §5.2/§5.3. Extracting connections from existing prose automatically is also out. The migration is an agent doing content work with these tools, not a heuristic.
