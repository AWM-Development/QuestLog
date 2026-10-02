# T-103 — Split packages/mcp/src/server.test.ts into per-tool test files

**Outcome:** shipped
**Branch:** chore/mcp-test-hygiene/t-103-split-server-test-file
**Diff:** 30 files changed, +4526/-4229 lines
**Complexity tier:** L
**Strategy-gate flag:** no

## What shipped

`packages/mcp/src/server.test.ts` (4,301 lines, 23 `describe` blocks — grown
from ~2,585/17 at drafting time) is now split into `packages/mcp/src/test-helpers.ts`
(shared fixtures) plus 22 one-file-per-tool test files under
`packages/mcp/src/tools/`, mirroring production `tools/*.ts` 1:1.
`server.test.ts` itself shrank to 80 lines, holding only the residual
cross-cutting `global-setup DB truncation wiring (T-052)` test per the
ticket's Scope step 3. No test content changed — purely mechanical.

## Test evidence

```
$ bash scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (1040 passed)
```

Package-scoped run (isolates the exit condition's exact before/after count):

```
$ pnpm --filter @questlog/mcp test
 Test Files  29 passed (29)
      Tests  158 passed (158)
```

Baseline (captured from a clean checkout of the original single-file
`server.test.ts` before the split began): `Tests 158 passed (158)` —
identical to the post-split count above.

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see pasted
  `scripts/run-tests-quiet.sh` output above (repo-wide) and the
  package-scoped `pnpm --filter @questlog/mcp test`/`typecheck`/`lint` runs,
  all clean.
- **Identical total test count before and after** — `158 passed (158)` both
  before (single-file baseline) and after (29 files) — exact match.
- **No single test file over ~400 lines** — `find packages/mcp/src -name
  "*.test.ts" | xargs wc -l | tail -1` confirms; largest is
  `log-session.test.ts` at 358 lines.
- **`server.test.ts` no longer contains any per-tool `describe` block** —
  confirmed via grep; only the T-052 infra block remains (80 lines total).

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim:

> This is a clean, well-executed mechanical split. Verified: All 23 original
> `describe` blocks accounted for across 27 new/existing files, mapped 1:1 to
> production tool files (with two well-reasoned, documented exceptions in
> `Docs/IMPLEMENTATION_NOTES.md` § T-103 for the inventory quick-actions and
> the three-way `ingest_text` split). Test content is byte-identical where
> checked (spot-checked `query-lore.test.ts` against the original block) —
> no assertions weakened or added. `pnpm --filter @questlog/mcp test`:
> 158/158 passed, matching the exit condition's before/after count exactly.
> `pnpm --filter @questlog/mcp typecheck` and `lint`: clean. `server.test.ts`
> reduced to 80 lines containing only the T-052 infra test, exactly per
> Scope step 3. No file over ~360 lines; largest is `log-session.test.ts` at
> 358. Shared fixtures correctly centralized in
> `packages/mcp/src/test-helpers.ts`, one `createTestDb()` call, imported
> (not re-duplicated) by every new file. `packages/mcp/src/tools/campaign-scoping.test.ts`
> (pre-existing, unrelated) untouched. `fileParallelism: false` addition to
> `vitest.config.ts` is a legitimate, well-flagged necessary fix (real
> cross-file DB pollution the split exposed), not scope creep — the ticket
> explicitly anticipated this exact contingency ("if it turns out a config
> change actually is needed, that's a scope gap significant enough to flag
> rather than quietly patch"), and it was. `CHANGELOG.md` and
> `Docs/IMPLEMENTATION_NOTES.md` both updated appropriately; ticket file
> correctly still in `in-progress/` (expected pre-Step-7).
>
> One comment-discipline finding:
>
> - `packages/mcp/vitest.config.ts:18-31` — the `fileParallelism: false`
>   comment re-narrates the full investigation (specific file names,
>   "observed directly," flake counts) that's already captured in full in
>   `Docs/IMPLEMENTATION_NOTES.md` § T-103. Per the comment-discipline rule
>   (cite-not-restate, `G-013`), this should collapse to a short WHY plus a
>   one-line pointer — the adjacent T-027 comment in the same file is the
>   right model to follow.

**Remediation:** trimmed the flagged comment down to a short WHY + pointer
to `IMPLEMENTATION_NOTES.md § T-103`, re-ran the full test/typecheck/lint
suite (still clean, see above), committed separately
(`169493c`).

## Efficiency notes

Mechanical L-tier ticket, mostly bounded by sheer file count (23 describe
blocks → 27 output files) rather than any tricky logic. The genuine
non-mechanical finding was real: splitting one file into many exposed
cross-file DB pollution under Vitest's default file-level parallelism
(`list-campaigns.test.ts`/`create-campaign.test.ts` flaked with leftover
rows from concurrently-running files' `beforeEach` hooks) — invisible
pre-split because everything ran in one serialized file.
`fileParallelism: false` fixes it; documented in
`Docs/IMPLEMENTATION_NOTES.md § T-103` rather than silently patched, per the
ticket's own explicit anticipation of this exact contingency. One
first-pass attempt at this ticket failed mid-run on an unrelated
infrastructure API error (before any file changes landed) and was retried
clean from the same pickup commit — not counted against the ticket's own
iteration cap, since it never reached Step 4's Red/Green loop.

**Retry log:** 0 retries against the ticket's Red/Green iteration cap. The
one reviewer-flagged note (comment-discipline) was a single-pass
remediation post-review, per Step 5's "make exactly one remediation pass"
rule — not a Step 4 retry.

## Anything Alex must decide

None. Two judgment calls were made and documented per the ticket's own
allowance (Scope step 2's "note it in the report if made"):

1. The four quick-action inventory tools (`add_item`/`transfer_item`/
   `adjust_wealth`/`list_inventory`) stayed combined in one
   `tools/add-item.test.ts` (218 lines) — already well under the size
   ceiling as one block.
2. The 587-line `ingest_text + get_source_status` block split into
   **three** files, not two: `get-source-status.test.ts`,
   `ingest-text.test.ts`, and `ingest-text-candidates.test.ts` (entity/
   contradiction-candidate tests, T-079/T-159/T-164) — the third has no
   1:1 production-file counterpart, flagged explicitly since it deviates
   from the strict mirroring convention.
