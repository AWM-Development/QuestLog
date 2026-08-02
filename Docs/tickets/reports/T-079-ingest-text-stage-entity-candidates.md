# T-079 — Stage extraction candidates from `ingest_text`

**Outcome:** shipped
**Branch:** feat/m-extract/t-079-ingest-text-stage-entity-candidates
**Diff:** 4 files changed, +97/-5 lines
**Complexity tier:** not specified in ticket (pre-tier format)
**Strategy-gate flag:** no

## What shipped

`ingest_text` now runs T-078's `entityService.detectCandidates` against the ingested content on every call and, when it finds at least one new-entity candidate, stages the list via `writeRequestService.createPreview` (`toolName: "ingest_entities"`). The tool's response gains `entityCandidates: { token, candidates } | null` alongside the existing `source` field — `null`, with no `write_requests` row, when there are no candidates. The existing source/chunk direct-write path and fire-and-forget embedding are unchanged. The tool description now tells the calling agent it can review `entityCandidates` and call the (not-yet-built) confirm tool from T-080.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (713 passed)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — confirmed above.
- **`ingest_text` with content containing a detectable new entity returns both `source` and a non-null `entityCandidates.token`/`candidates`, without creating any entity row** — `packages/mcp/src/server.test.ts` `"stages entityCandidates as a write_requests preview when content contains a detectable new entity (T-079)"`: asserts `payload.source.id`, `payload.entityCandidates.token`, `payload.entityCandidates.candidates` contains `{ name: "Vespera Nightveil", entityType: "npc" }`, and a direct `entities` table query for the campaign returns zero rows.
- **`ingest_text` with content containing no detectable candidates returns `entityCandidates: null` and creates no `write_requests` row** — same file, `"returns entityCandidates: null and stages no write_requests row when content has no detectable candidates (T-079)"`: asserts `payload.entityCandidates` is `null` and a direct `write_requests` table query for the campaign returns zero rows.

## Reviewer verdict

PASS-WITH-NOTES. Reviewer's verbatim findings:

1. Functionality vs. exit conditions — met, both new tests assert against real DB queries rather than just response shape.
2. Pattern conformance — consistent with the `log_session` preview precedent; no service-layer logic pushed down incorrectly; non-`Unscoped` service calls per the campaign-scoping rule.
3. Modified pre-existing test (`get_source_status reports pending then done`) — legitimate fix for a real timing side-effect this ticket's own synchronous `detectCandidates` await introduces, not a weakening to hide a bug.
4. Comment duplication — the two new tests repeated an identical two-line cleanup comment verbatim; **fixed** post-review by collapsing to one full comment plus a one-line pointer at the second site (commit `1e8ee46`).
5. Minor scope note (not a blocker) — `detectCandidates` runs on every chunked `final: false` call too, staging a preview per partial chunk; the ticket's Scope doesn't address multi-call splitting for candidate detection and no test exercises that interaction. Left as-is; flagged below for Alex.

## Efficiency notes

Ran tight — one real mid-ticket surprise (see retry log) beyond the initial red/green pass, both caught by the test suite itself rather than by manual inspection.

**Retry log:** 2 retries, both `genuine_bug_caught_by_test`:
1. First full-suite run surfaced a FK-violation in `afterEach`'s `deleteCampaignTree` for both new tests — the fire-and-forget embed pipeline hadn't settled by test end, so `sources` delete raced `chunks` insert. Fixed by awaiting `waitForStatus(..., "done")` at the end of each new test, mirroring the pattern already used elsewhere in the same describe block.
2. Same full-suite run then surfaced a genuine regression in a pre-existing test (`get_source_status reports pending then done`) — the new synchronous `detectCandidates` await delays `ingest_text`'s response just enough that a subsequent `get_source_status` call can already see `"extracting"` instead of `"pending"`. Confirmed consistent (not flaky) across 3 repeated runs. Fixed by relaxing that assertion to `status !== "done"` (still in flight), which preserves the test's actual intent without depending on exact stage timing. Documented in `Docs/IMPLEMENTATION_NOTES.md` § T-079.

Lint formatting (biome) needed one auto-fix pass (`npx biome check --write .`) after the initial test additions and again after the post-review comment dedup — not counted as a retry since it's mechanical formatting, not a lint *failure* requiring a code decision.

## Anything Alex must decide

- **Multi-chunk `ingest_text` calls (`final: false`) each stage their own entity-candidate preview against only that call's own `content`.** Not addressed by the ticket's Scope text and untested here. If a document is split across several `ingest_text` calls, the agent will see a separate `entityCandidates` token per chunk rather than one consolidated preview for the whole document. Worth deciding whether T-080 (the confirm tool) or a follow-up ticket should consolidate these, or whether per-chunk staging is fine as-is.
- **M-EXTRACT.2's milestone checkbox was left unflipped** — it covers `(T-079, T-080)` together and T-080 (the confirm tool) hasn't landed yet. Will flip once T-080 ships.
