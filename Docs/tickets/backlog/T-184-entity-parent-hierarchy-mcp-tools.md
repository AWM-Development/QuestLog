# T-184 — MCP tool surface for sub-entities (create/get/list)

Milestone ref: `Docs/milestones/MILESTONES_BUGS.md` § M-BUG.8

Complexity tier: M

Strategy-gate flag: yes

Priority: P0

Blocked on: T-183 — must be merged into develop first

Branch: feat/m-bug/t-184-entity-parent-hierarchy-mcp-tools

Context files (load ONLY these):
  - `packages/mcp/src/tools/create-entity.ts`, `packages/mcp/src/tools/get-entity.ts`, `packages/mcp/src/tools/list-entities.ts`
  - `packages/shared/src/validators/entity.ts` (`EntityCreateInput`, `GetEntityInput`, `ListEntitiesInput`)
  - `packages/mcp/src/content/tool-descriptions.ts` (`CREATE_ENTITY_DESCRIPTION`, `GET_ENTITY_DESCRIPTION`, `LIST_ENTITIES_DESCRIPTION`)
  - `packages/core/src/lib/errors.ts` (`AmbiguousEntityError`, added in T-183)
  - `.claude/rules/mcp.md` § "Agent-interaction philosophy" (tool-description instruction rules), § "Error shape"
  - `Docs/tickets/gated/resolved/G-053-composable-sub-entities.md` (the decision this ticket implements, including the explicit "agent asks the user to clarify" resolution model)

Mockup: none

Runner: claude-code

Model: sonnet

Scope: Wire T-183's `parentEntityId` schema/service support into the three read/create MCP tools, so a calling agent can create a sub-entity, look one up scoped to a known parent, list a parent's children, and — when it doesn't know the parent — get a clear signal to ask the user instead of QuestLog silently guessing.

1. **`create_entity`**: add optional `parentEntityId: z.string().uuid().optional()` to `EntityCreateInput`; pass it through to `entityService.createSeeded` in `create-entity.ts`. No preview/confirm change — `create_entity` stays additive-only per `.claude/rules/mcp.md`.
2. **`list_entities`**: add optional `parentEntityId: z.string().uuid().optional()` to `ListEntitiesInput`; pass it through to `entityService.list` in `list-entities.ts`.
3. **`get_entity`**:
   - Add optional `parentEntityId: z.string().uuid().optional()` to `GetEntityInput`, valid only alongside `name` (not `entityId` — an id lookup is already unambiguous). Pass it through to `entityService.getByName`.
   - Catch `AmbiguousEntityError` in `get-entity.ts` (via `withToolErrors`, same as any other typed service error per `.claude/rules/mcp.md` § "Error shape") and shape its result distinctly from a generic not-found — e.g. `{ error: { code: "ambiguous_entity", message, candidates: [{ id, name, type, parentEntityId }] } }` — so the calling agent can tell "ambiguous, ask the user" apart from "not found, nothing matches."
   - When the resolved entity has children (rows where `parentEntityId === entity.id`), include a lightweight `children: [{ id, name, type }]` summary array in the response — same treatment `linkedEntity` already gets (a summary, not full recursive entities), omitted entirely when there are no children rather than an empty array, so the common no-children case's JSON shape is unchanged from before.
4. **Tool descriptions**: update `CREATE_ENTITY_DESCRIPTION`/`GET_ENTITY_DESCRIPTION`/`LIST_ENTITIES_DESCRIPTION` to document the new field(s), and — per `.claude/rules/mcp.md`'s agent-interaction philosophy — explicitly instruct the calling model that on an `ambiguous_entity` result, it must ask the user which one they mean (per G-053's resolution) rather than guessing or silently picking the first candidate.
5. Add/update `packages/mcp` tool tests for: `create_entity` with `parentEntityId`, `list_entities` filtered by `parentEntityId`, `get_entity` scoped by `parentEntityId`, `get_entity` returning the `ambiguous_entity` shape for a cross-parent name tie, and `get_entity` including `children` when present.

Out of scope: Any change to `log_session`'s auto-linking (`detectSpans`) to account for parent/child context — that's a separate concern per G-053's Notes, not part of this MCP-surface ticket. No new dedicated "list children" tool — `list_entities`'s new filter covers it. No automatic disambiguation heuristics beyond the exact-tie case T-183 already defines (e.g. no "prefer the most recently discussed entity" logic) — the resolution model is "surface the ambiguity, let the agent ask," not QuestLog guessing smarter.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `create_entity` called with a valid `parentEntityId` persists and returns an entity whose `parentEntityId` matches
  - `get_entity` called by `name` + `parentEntityId` returns the correct scoped child even when a same-named entity exists under a different parent
  - `get_entity` called by `name` alone (no `parentEntityId`) against two same-named entities under two different parents returns `{ error: { code: "ambiguous_entity", candidates: [...] } }` listing both, not a silently-picked single result
  - `get_entity` on a parent entity with two children returns a `children` array listing both; on an entity with none, `children` is absent from the response

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_BUGS.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
