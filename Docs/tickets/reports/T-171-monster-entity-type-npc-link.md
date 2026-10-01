# T-171 — monster entity type + npc↔monster linkedEntityId FK

**Outcome:** shipped
**Branch:** feat/m-statblock/t-171-monster-entity-type-npc-link
**Diff:** 18 files changed, +2328/-53 lines
**Complexity tier:** M
**Strategy-gate flag:** yes (resolved — `G-036`, see ticket's Relevant background)

## What shipped

`ENTITY_TYPES` gains `"monster"`. `entities` gains a nullable, self-referential, indexed `linkedEntityId` FK so a lore-focused `npc` and its combat-focused `monster` counterpart can be paired: setting it links both sides symmetrically in one write, setting it to `null` clears both sides, and relinking to a different entity clears the old target's back-pointer too. `create_entity`, `update_entity`/`confirm_update_entity`, and `get_entity` are wired through, all same-campaign-validated.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (1002 passed)
```

(`scripts/run-tests-quiet.sh` — full fail-fast lint → typecheck → test chain, run clean after the reviewer's remediation pass. Full logs under `tmp/test-logs/`.)

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above.
- **`campaign-scoping.test.ts`'s guard still passes unmodified** — file untouched; guard passes as part of the 1002-test run (no `*Unscoped` call introduced — `entityService.getById` is already campaign-scoped, reused as-is for the link-target check).
- **symmetric write proven both directions** — `entity.service.test.ts` "entityService linkedEntityId (T-171)" > "sets both sides symmetrically when creating a monster linked to an npc": creates npc A, creates monster B with `linkedEntityId: A.id`, asserts `getById(B.id).linkedEntityId === A.id` and `getById(A.id).linkedEntityId === B.id`.
- **`linkedEntityId: null` clears both sides** — same describe block, "clears both sides symmetrically when update sets linkedEntityId to null": links A↔B, updates B to `linkedEntityId: null`, asserts both sides return `null`. Also covered at the MCP-tool level in `server.test.ts` ("previews and confirms clearing a link via linkedEntityId: null").
- **cross-campaign linkedEntityId throws `NotFoundError`** — "throws NotFoundError creating with a linkedEntityId from a different campaign" and the equivalent `update` case; MCP-tool-level equivalents in `server.test.ts` assert `error.code === "NOT_FOUND"` for both `create_entity` and `update_entity`.
- **`get_entity` linkedEntity summary present/absent** — `server.test.ts` "get_entity tool — linkedEntity (T-171)": "includes a linkedEntity summary when the entity has a linked pair" asserts `{ id, name, type }` matching the paired entity; "omits the linkedEntity key entirely for an unlinked entity" asserts `"linkedEntity" in payload === false`.

## Reviewer verdict

**FAIL** (first pass), remediated, now clean. Verbatim first-pass finding:

> **Correctness bug — relinking to a different entity leaves a stale, asymmetric back-pointer.** `packages/core/src/services/entity.service.ts:626-662` (`update`). The Scope section's first bullet states unconditionally: "setting `linkedEntityId` on entity A to entity B's id sets both A→B and B→A in the same write — the link is always mutual." The implementation only handles two of the three possible transitions: unlinked → linked (handled), linked → null (handled), **linked → a different linked entity (not handled, not tested)**. Trace: if A is linked to B and `update(A, { linkedEntityId: C })` is called, the code only validates C and never clears B's back-pointer — B is left pointing at A even though A no longer points at B. This is a real, reachable production path (a DM correcting an initial mis-link in a single `update_entity` call), not hypothetical. ... **FAIL**

Remediation: the old-target-clearing branch now fires on *any* transition away from the current target (to `null`, or to a different id), not only the null-clear path. Added a regression test ("clears the old target's back-pointer when relinking to a different entity") covering the exact scenario the reviewer traced. Full lint/typecheck/test rerun clean after the fix (see Test evidence).

## Efficiency notes

Ran close to a normal M-tier ticket — the ticket's Context files list was accurate and complete, and the symmetric-link design was already fully specified in the ticket's Scope text, so no mid-ticket scope discovery was needed. One real snag: my first pass at the MCP-tool-level `get_entity` linkedEntity tests placed them inside the existing `describe("get_entity tool", …)` block, which uses the raw `BEGIN`/`ROLLBACK` test pattern — but `entityService.create`'s new conditional `db.transaction()` (only opened when `linkedEntityId` is present) doesn't compose with that, and silently commits the outer transaction instead of erroring, so the failure only surfaced later as an unrelated-looking leaked-row assertion failure in a different `describe` block. Diagnosed by bisecting against the pre-change baseline (confirmed the full suite passed clean before this ticket's changes) and re-reading `.claude/rules/backend.md`'s "Test DB pattern" section; fixed by moving those two tests into their own `deleteCampaignTree`-based `describe` block, and recorded as a `Docs/IMPLEMENTATION_NOTES.md` entry so a future ticket adding a test under an existing `BEGIN`/`ROLLBACK` block doesn't hit the same silent-leak trap.

**Retry log:** 1 retry, `genuine_bug_caught_by_test`-adjacent — not a failing test locally (the leaked-row symptom only appeared once the full suite ran, not the isolated file), but the reviewer's Step-5 FAIL was a second, cleaner catch of a related class of bug (an untested transition of the same feature). Neither counted against the ticket's iteration cap in Step 4 (both were pre-Step-5 self-caught and the Step-5 remediation pass respectively, not a Red/Green retry).

## Anything Alex must decide

None. The relink-transition bug the reviewer caught is fixed and tested; no scope was cut to ship this. `M-STATBLOCK.0` checkbox flipped in `Docs/milestones/MILESTONES_V1_8_MCP.md`; `T-175`–`T-178` (stat-block columns, templates, rendering) remain queued as separate tickets per the milestone's own task list.
