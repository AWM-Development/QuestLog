# T-162 — DM-only notes: read path with [PARTY]/[DM] tagging

Milestone ref: M-PARTYKNOW (`Docs/milestones/MILESTONES_V1_7_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-partyknow/t-162-dm-only-notes-read-path-tagging

Context files (load ONLY these):
  - packages/core/src/services/context.service.ts (`formatEntity`, and the "Entities" section of `assemble` — the narrative text `query_lore` returns)
  - packages/core/src/services/brief.service.ts (`LikelyNpc` interface and its assembly query — the structured, non-narrative fields `prep_brief` returns)
  - packages/mcp/src/tools/get-entity.ts
  - packages/mcp/src/content/tool-descriptions.ts
  - Docs/tickets/gated/resolved/G-032-party-knowledge-epistemic-state.md (this gate's resolution — full rationale, including why `get_entity`/`prep_brief` don't need bracket-tagging the way `query_lore` does)
  - Docs/tickets/T-161-dm-only-notes-write-path.md (the write path this ticket's read path surfaces — not a build dependency, this ticket's own tests seed `dmNotes` directly via the test DB, but read it for the exact field/param shapes it introduces)

Mockup: none

Runner: claude-code

Model: sonnet

Scope: Surface the now-writable `entities.dmNotes` field across the three read tools, with an explicit convention for telling DM-only content apart from party-safe content wherever multiple entities' fields get mixed into one freeform narrative text block.

- Define the tagging convention once, shared: a small pair of exported string constants (e.g. `PARTY_TAG = "[PARTY]"`, `DM_TAG = "[DM]"`) in a shared spot both `context.service.ts` and `brief.service.ts` can import — `packages/core/src/lib/utils.ts` is the existing home for small shared helpers/constants in this codebase; add them there rather than creating a new file for two constants.
- `context.service.ts`'s `formatEntity`: extend to accept `dmNotes: string | null` alongside the existing `name`/`type`/`summary`. Emit the existing summary line prefixed with `[PARTY] ` (e.g. `[PARTY] Elenna (npc): a retired sellsword`, or `[PARTY] Elenna (npc)` with no summary — same shape as today, just tagged). When the entity has non-null `dmNotes`, emit a second line immediately after: `[DM] <dmNotes>`. An entity with no `dmNotes` gets no second line at all — no empty `[DM]` tag ever appears. `assemble`'s entity-fetch query needs to select `dmNotes` alongside the columns it already reads; the `## Campaign Entities` section header and token-budget accounting are otherwise unchanged (the added `[DM]` line just counts toward the same per-entity token cost the loop already estimates).
- `brief.service.ts`: add `dmNotes: string | null` to the `LikelyNpc` interface, and select `entities.dmNotes` alongside `entities.summary` in the `npcMentions` query. `prep_brief`'s output is already a structured JSON object (not one narrative blob like `query_lore`'s `text`), so this is a plain field addition — no `[PARTY]`/`[DM]` bracket-tagging needed here; `PREP_BRIEF_DESCRIPTION` gets a line stating `dmNotes` is for the DM's own prep reading, not something to read aloud verbatim to players.
- `get_entity`: no code change needed — `entityService.getById`/`getByName` already select the full row, so `dmNotes` will appear in the response automatically once `T-161` starts writing it. Update `GET_ENTITY_DESCRIPTION` only, to state explicitly that `dmNotes` is DM-only background information (never to be read aloud or paraphrased to players), while `description`/`summary` are party-safe.
- `packages/mcp/src/content/tool-descriptions.ts`: update `QUERY_LORE_DESCRIPTION` to document the `[PARTY]`/`[DM]` line convention in the assembled entities section, and instruct the calling agent to never speak a `[DM]`-prefixed line aloud to players.

Out of scope:
  - The chunk-search section of `query_lore`'s assembled text (citations/content from ingested sources) — `dmNotes` is an entity-level field only, chunks are untouched by this gate.
  - Any frontend/UI rendering of `dmNotes` or the `[PARTY]`/`[DM]` tags.
  - `list_entities` — unaffected, out of this ticket's read-tool set.
  - Changing `formatCampaignMetadata` or the conversation-history section of `context.service.ts`'s assembled text — neither carries entity-level `dmNotes`.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `query_lore`'s assembled `text` includes a `[DM] ...` line for a seeded entity with `dmNotes` set, immediately following its `[PARTY] ...` summary line
  - `query_lore`'s assembled `text` includes no `[DM]` line at all for an entity with `dmNotes` left null (no empty-tag leakage)
  - `prep_brief`'s `likelyNpcs` array includes a populated `dmNotes` field for a seeded NPC entity that has one set, and `null` for one that doesn't
  - `get_entity`'s response includes the entity's `dmNotes` field, matching the seeded value

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_7_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
