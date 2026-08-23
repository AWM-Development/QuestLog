# T-170 — borrow_entity: copy-once cross-campaign entity fork

**Outcome:** shipped
**Branch:** feat/m-crosscampaign/t-170-borrow-entity-cross-campaign-fork
**Diff:** 7 files changed, +186/-0 lines
**Complexity tier:** S
**Strategy-gate flag:** yes (already resolved — `G-033`)

## What shipped

A new MCP tool, `borrow_entity`, that reads one entity from a source campaign and writes an independent copy into a destination campaign — a one-time fork with no ongoing sync back to the original. The copy carries a provenance record: a note appended to `dmNotes` and a structured `attributes.borrowedFrom` field.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (989 passed)
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — confirmed via `scripts/run-tests-quiet.sh` (see Test evidence above).
- **`campaign-scoping.test.ts`'s "no packages/mcp/src/tools/*.ts file calls an Unscoped method" assertion still passes unmodified with `borrow-entity.ts` present** — included in the 989 passing tests; `borrow-entity.ts` only calls `entityService.getById`/`campaignService.getById`/`entityService.create`, none suffixed `Unscoped`.
- **`borrow-entity.test.ts`-equivalent (added to `packages/mcp/src/server.test.ts`'s `borrow_entity tool` describe block)** — "copies the entity into the destination campaign with a fresh id, provenance note, and borrowedFrom attributes, leaving the source unchanged" asserts: fresh `id` distinct from source, `name`/`type`/`description` match verbatim, `dmNotes` contains both the original note and the appended provenance line, `attributes` equals exactly `{ borrowedFrom: { campaignId, entityId, name, forkedAt } }` with no `seededFrom` or other key, and the source entity is unmodified in its own campaign — all confirmed passing.
- **Not-found assertions** — "returns a well-formed not-found error for a nonexistent destCampaignId" and "...for an entityId that doesn't exist in sourceCampaignId" both pass, exercising `NotFoundError` through the new tool via `withToolErrors`.

## Reviewer verdict

PASS

> All rule requirements are satisfied: thin adapter, one file per tool, description constant, `ToolDeps` used, `withToolErrors` wraps the handler, additive-only write (no preview/confirm), and campaign-scoped lookups only.
>
> Everything in the diff matches the ticket's Scope and Exit condition precisely, tests are substantive (not theater — they assert exact field values, distinct ids, unmodified source, and both NotFoundError paths), Out-of-scope items are respected (no live-link, no lore/inventory/session copying, no confirm step, no UI), and the campaign-scoping guard passes unmodified as designed.
>
> Minor observations, none blocking:
>
> - `packages/mcp/src/tools/borrow-entity.ts:19-21` — comment justifying the unused return of `campaignService.getById(db, destCampaignId)` is a fine, short WHY note; acceptable as-is.
> - The dmNotes separator (`\n\n${provenanceLine}`) doesn't include the `---` divider `createSeeded` uses for description (`packages/core/src/services/entity.service.ts:522`), only the blank-line spacing that `appendToDescription`/`appendDmNote` use (lines 697, 727). The ticket's phrasing ("same separator convention `createSeeded`'s... append already uses") is ambiguous enough that this is a defensible reading, and it matches the more directly-analogous `appendDmNote` convention already in the same service — not worth failing over.
>
> PASS

## Efficiency notes

Straightforward S-tier ticket — the gate (`G-033`) was already fully resolved with the fork shape, provenance format, and dmNotes separator convention spelled out, so no design judgment calls were needed. Context files matched the actual implementation closely (`create-entity.ts` and `get-entity.ts` as structural precedent). One TDD checkpoint: wrote the full test suite against the not-yet-registered tool (red — 1 failure of the expected shape plus 2 JSON-parse failures on the MCP "unknown tool" error string, both correctly diagnosable as "tool not registered yet"), then implemented validator + description + onboarding line + tool file + registration in one pass (green) on the first attempt.

**Retry log:** 0 retries.

## Anything Alex must decide

None. The reviewer's dmNotes-separator note above is a documented, defensible reading of the ticket's phrasing, not a functional gap.
