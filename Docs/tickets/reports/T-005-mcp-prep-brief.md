# T-005 — `prep_brief` MCP tool (read)

**Outcome:** shipped
**Branch:** feat/m-mcp/t-005-prep-brief
**Diff:** 9 files changed, +511/-7 lines

## What shipped

A read-only `prep_brief(campaignId, sessionCount?)` MCP tool that assembles a
session prep brief from real campaign data: a "Previously on" recap of the
most recent 1-2 sessions, active plot threads derived from session tags
(closed by a `resolved:<tag>` marker), a "Likely NPCs" list of NPC entities
mentioned in recent session content, and quick links mirroring those NPCs.
Loose ends & suggested follow-ups return a stable empty-with-explanation
shape, matching the ticket's scope (both require agent/LLM analysis out of
scope for v1).

## Test evidence

```
$ pnpm lint
@questlog/shared:lint: Checked 13 files in 17ms. No fixes applied.
@questlog/mcp:lint: Checked 8 files in 26ms. No fixes applied.
@questlog/server:lint: Checked 69 files in 123ms. No fixes applied.
@questlog/web:lint: Checked 158 files in 174ms. No fixes applied.
 Tasks:    4 successful, 4 total

$ pnpm typecheck
 Tasks:    4 successful, 4 total
(all four packages — @questlog/mcp, @questlog/server, @questlog/shared, @questlog/web — typecheck clean)

$ DATABASE_URL=postgresql://questlog:questlog@localhost:5433/questlog_test pnpm test
@questlog/mcp:test:  ✓ src/server.test.ts (5 tests) 114ms
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  5 passed (5)

@questlog/server:test:  ✓ src/services/brief.service.test.ts (8 tests) 272ms
@questlog/server:test:  Test Files  27 passed (27)
@questlog/server:test:       Tests  209 passed (209)

@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)

 Tasks:    3 successful, 3 total
```

## Exit condition check

- **`prep_brief` against a fixture campaign with 2+ seeded sessions (one
  referencing a seeded NPC entity) returns a non-empty "previously on"
  section built from the latest session's summary/content, and that NPC
  listed under "Likely NPCs"** — `apps/mcp/src/server.test.ts:133-171`
  ("returns previously-on text and the mentioned NPC under likely NPCs"):
  seeds a real NPC entity, two real sessions (one mentioning the NPC by
  name, the other finalized with a summary), calls the tool through a real
  MCP client/server transport pair, and asserts `previouslyOn[0].text`
  equals the finalized summary and `likelyNpcs` contains the real entity id
  — against actual DB rows, not mocks.
- **`prep_brief` against a campaign with zero sessions returns a well-formed
  empty brief rather than throwing** —
  `apps/mcp/src/server.test.ts:177-194` asserts every section
  (`previouslyOn`, `activeThreads`, `likelyNpcs`, `quickLinks`,
  `looseEnds.items`, `suggestedFollowUps.items`) is present and empty for a
  real campaign with no sessions. Also covered service-side in
  `apps/server/src/services/brief.service.test.ts`'s "empty campaign"
  describe block.
- Additional service-level coverage beyond the two exit conditions:
  `brief.service.test.ts` covers the summary-vs-content-excerpt fallback,
  the `resolved:<tag>` thread-closing convention, and NPC-type filtering
  (a mentioned `location` entity is correctly excluded from `likelyNpcs`).

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim:

> Scope verification (all 6 sub-items): [...] Implemented. [...]
> Exit conditions — verified independently, not test theater: Ran
> `pnpm --filter @questlog/server exec vitest run src/services/brief.service.test.ts`
> (8/8 pass) and `pnpm --filter @questlog/mcp exec vitest run src/server.test.ts`
> (5/5 pass) against the real Postgres instance on :5433 — both suites use
> real `campaignService.create`/`sessionService.create`/`finalize`/
> `entityService.create` and real DB rows, not mocks. [...] Also independently
> confirmed `pnpm --filter @questlog/server typecheck`,
> `pnpm --filter @questlog/mcp typecheck`, and biome check on the touched
> files all pass clean.
>
> Out of scope check: no schema changes ([...] zero touches to
> `apps/server/src/db/`), no web/UI changes (zero touches to `apps/web/`),
> no brief persistence, no relationship-graph proximity beyond the
> mention-recency heuristic. Clean.
>
> Pattern conformance: `prep_brief` registration in
> `apps/mcp/src/server.ts:61-93` mirrors `query_lore`'s try/catch →
> `NotFoundError` → `{isError: true, content:[...]}` shape exactly [...],
> consistent with `.claude/rules/mcp.md`'s thin-adapter and error-shape
> requirements. [...]
>
> `session_entities` fallback honesty: confirmed genuine — `brief.service.ts`
> never references `session_entities` at all; it always takes the
> `detectSpans` path, and `Docs/IMPLEMENTATION_NOTES.md:384-386` states this
> plainly along with a note to revisit once T-003/T-004 land. Not a silent
> no-op.
>
> Minor findings (notes only):
> - `apps/server/src/services/brief.service.ts:133` (`summary: entity.summary`)
>   — `entityService.create` [...] only ever populates `entities.description`,
>   never `entities.summary` [...]. `LikelyNpc.summary` will be `null` for
>   every NPC until a future consolidation ticket populates it — correct
>   shape, but no test [...] exercises a non-null `summary` value [...].
>   Worth a one-line callout in `IMPLEMENTATION_NOTES.md` [...].
> - No morning report exists for T-005 in `Docs/tickets/reports/` [...] —
>   the ticket's own Definition of Done requires one.
>
> No functionality gaps, no scope creep, no test theater found. [...]
>
> PASS-WITH-NOTES

Both notes were addressed before this report was written: the
`LikelyNpc.summary`-is-always-null callout was added to
`Docs/IMPLEMENTATION_NOTES.md` (§"`LikelyNpc.summary` is always `null`
today"), and this report is the missing deliverable the second note flagged.

## Anything Alex must decide

- **Ordering-constraint deviation, flagged by the ticket itself, not a
  judgment call I made unilaterally:** `MILESTONES_V1_MCP.md`'s ordering
  note says `M-MCP.3 → M-MCP.4`, and T-003/T-004 (M-MCP.3) have not shipped
  to `develop` — T-002 (the plumbing they depend on) is still an open PR
  (#27). T-005's own ticket text explicitly anticipates this ("T-003/T-004
  are not a hard blocker... but the brief is far more meaningful once real
  logged sessions exist — sequence this last regardless") and was sitting
  unblocked in `queue/` (no `Blocked on:` line), so it was picked per the
  executor routine's Step 1 selection order. Once T-003 ships, `likelyNpcs`
  should be revisited to join through the real `session_entities` table
  instead of re-running `detectSpans` per brief call — noted in
  `IMPLEMENTATION_NOTES.md`.
- **Scoping gap in the ticket's own Context files list:** it references
  "get_entity/list_entities tool files" (from T-006) as the pattern to
  mirror, but T-006 hasn't shipped to `develop` either — `apps/mcp/src/server.ts`
  only had `query_lore` to mirror against. Used that directly (same
  try/catch → `NotFoundError` shape); noted in `IMPLEMENTATION_NOTES.md`.
- **`resolved:<tag>` tag convention for closing a plot thread** is new and
  undocumented outside this ticket's code/notes — no ticket or PRD section
  specifies how threads get marked resolved via tags alone. If a future
  ticket adds tag-entry UI, it should surface this convention rather than
  inventing a second one.
- No 🧠 strategy gates were present in this ticket's scope.
