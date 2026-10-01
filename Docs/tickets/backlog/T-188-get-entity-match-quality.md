# T-188 — `get_entity` name lookup reports match quality (exact vs. fuzzy + score)

Milestone ref: `Docs/milestones/MILESTONES_BUGS.md` § M-BUG.9

Complexity tier: S

Strategy-gate flag: no

Priority: P0

Blocked on: T-184 — must be merged into develop first (T-183 and T-184 both rewrite `getByName` and `get-entity.ts`; serializing behind them avoids a three-way conflict on the same loop)

Branch: feat/m-bug/t-188-get-entity-match-quality

Context files (load ONLY these):
  - `packages/core/src/services/entity.service.ts` (`getByName`, `trigramSimilarity`, `FUZZY_THRESHOLD`, `wordSimilarityCandidateFilter`, plus T-183's `parentEntityId` scoping and `AmbiguousEntityError` once merged)
  - `packages/mcp/src/tools/get-entity.ts`
  - `packages/shared/src/validators/entity.ts` (`GetEntityInput`)
  - `packages/mcp/src/content/tool-descriptions.ts` (`GET_ENTITY_DESCRIPTION`)
  - `.claude/rules/mcp.md` § "Agent-interaction philosophy", § "Error shape"
  - `Docs/archive/FIELD_REPORT_ASH_KEEP_2026-10.md` (§ item 6 "Fuzzy-match false hit": the failure this fixes)

Mockup: none

Runner: claude-code

Model: sonnet

Scope: A name lookup for an entity that doesn't exist currently returns a *different* entity with no signal. Prod repro: `get_entity` with name "Ash Keep — Caldera Heat", before it existed, returned "Ash Keep", because the trigram score cleared `FUZZY_THRESHOLD = 0.4`. An agent doing fetch-then-update would write to the wrong entity. Make match quality explicit:

1. **Service**: add `entityService.getByNameWithMatch(...)`, taking the same parameters as `getByName` after T-183 (including the optional `parentEntityId`) and returning `{ entity, match: "exact" | "fuzzy", score }`.
   - `"exact"` means the candidate's name equals the query after `trim()` + case-insensitive comparison.
   - If an exact candidate exists, it wins over any higher-scoring fuzzy candidate.
   - `score` is the `trigramSimilarity` value for fuzzy matches, and always exactly `1` for exact matches (even when case or whitespace differ and the raw trigram score would be lower).
   - T-183's `AmbiguousEntityError` behavior is unchanged.
   - `getByName` keeps its current signature and return type and delegates (`(await getByNameWithMatch(...)).entity`), so existing callers and T-183's tests are untouched.
2. **`GetEntityInput`**: add optional `exact: z.boolean().optional()`, valid only with `name`. When `true`, a fuzzy-only best match throws `NotFoundError` (→ the existing `NOT_FOUND` shape), so "does an entity with exactly this name exist?" becomes one reliable call.
3. **`get-entity.ts`**: for name lookups only, add `match: { type: "exact" | "fuzzy", score, query }` to the response. Omit it entirely for `entityId` lookups, so the id-lookup JSON shape is unchanged (same "omit, don't null" convention as `linkedEntity`).
4. **`GET_ENTITY_DESCRIPTION`**: document `exact` and `match`. Tell the calling model, per `.claude/rules/mcp.md`'s agent-interaction philosophy: a `fuzzy` match is a *suggestion*, not proof the named entity exists. Before writing to a fuzzy-matched entity's id, confirm with the user. To check existence before creating, pass `exact: true`.
5. Tests: service tests in `entity.service.test.ts` and tool tests in `packages/mcp`, covering the exit conditions below.

Out of scope: Changing `FUZZY_THRESHOLD` or the candidate filter. Unicode or punctuation normalization beyond `trim()` + case-folding (e.g. em dash vs. hyphen). If that turns out to matter, it's a follow-up. `match` info on `list_entities`, `detectSpans`/`log_session` auto-linking, or any other caller of the fuzzy matcher. Any write-tool changes (`update_entity` etc. already take ids, not names).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - with only an entity named "Ash Keep" seeded, `get_entity({ name: "Ash Keep — Caldera Heat" })` returns the "Ash Keep" entity with `match.type === "fuzzy"` and `match.score < 1`
  - same seed: `get_entity({ name: "Ash Keep — Caldera Heat", exact: true })` returns the `NOT_FOUND` error shape
  - `get_entity({ name: "  ash keep " })` returns `match.type === "exact"`, `match.score === 1`
  - with "Ash Keep" and "Ash Keep Gate" both seeded, `get_entity({ name: "Ash Keep" })` returns "Ash Keep" (exact wins)
  - `get_entity({ entityId })` responses contain no `match` key

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_BUGS.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
