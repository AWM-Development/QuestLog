# T-159 — `ingest_text` returns an error after the source has already been written

**Outcome:** shipped
**Branch:** feat/m-bug/t-159-ingest-text-error-response-after-partial-success
**Diff:** 2 files changed, +73/-20 lines (excluding the ticket move itself)
**Complexity tier:** S
**Strategy-gate flag:** no

## What shipped

`ingest_text`'s handler now wraps the synchronous `entityService.detectCandidates` call (and its dependent `writeRequestService.createPreview` call) in a `try`/`catch`. A failure there — a transient LLM error, a rate limit, anything — now logs and degrades to `entityCandidates: null` instead of propagating and hiding the already-written `source.id`/`source.status` from the caller, which previously caused callers to retry and create duplicate sources.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (977 passed)
```

(`scripts/run-tests-quiet.sh` full output; per-stage detail only prints on failure, logs persisted under `tmp/test-logs/`.)

New test in isolation, before the fix (Red — confirms it fails for the right reason):
```
FAIL  src/server.test.ts > ingest_text + get_source_status tools > still returns the source id when entity-candidate detection throws (T-159)
AssertionError: expected true to be falsy
- Expected: false
+ Received: true
 ❯ src/server.test.ts:2922:26
   expect(result.isError).toBeFalsy();
```

Same test after the fix (Green):
```
✓ src/server.test.ts (100 tests | 99 skipped) 101ms
 Test Files  1 passed (1)
      Tests  1 passed | 99 skipped (100)
```

Full `ingest_text + get_source_status tools` describe block after the fix (no regressions):
```
✓ src/server.test.ts (100 tests | 86 skipped) 551ms
 Test Files  1 passed (1)
      Tests  14 passed | 86 skipped (100)
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — confirmed above (977 passed, 0 lint warnings, typecheck pass).
- **new test asserts `isError` falsy, `source.id`/`source.status` present, `entityCandidates` null, and DB persistence** — `packages/mcp/src/server.test.ts`'s new `"still returns the source id when entity-candidate detection throws (T-159)"` test (in the `ingest_text + get_source_status tools` describe block) uses an inline `llmService` mock whose `callClaudeStructured` is `vi.fn().mockRejectedValue(new Error("simulated LLM failure"))`, then asserts `result.isError` is falsy, `payload.source.id`/`payload.source.status` are defined, `payload.entityCandidates` is `null`, and `sourceService.getByIdUnscoped(db, payload.source.id)` resolves — confirming the source row genuinely exists.
- **existing success-path entity-candidate tests unchanged** — the T-079 tests (`"stages entityCandidates as a write_requests preview..."` and `"returns entityCandidates: null and stages no write_requests row..."`) pass unchanged in the same run, confirming the happy-path `entityCandidates` payload shape is untouched.

## Reviewer verdict

PASS-WITH-NOTES —

> Findings/observations:
> - `packages/mcp/src/tools/ingest-text.ts:70-73` — the local `entityCandidates` type declares `candidates: Awaited<ReturnType<typeof entityService.detectCandidates>>` inline rather than reusing the already-exported `EntityCandidateProposal[]` type (used in `packages/mcp/src/tools/confirm-ingest-entities.ts:13`). Not incorrect, just more verbose than necessary — a minor nit, not a functional issue.
>
> Everything else checks out:
> - Scope match: the `try`/`catch` wraps exactly `detectCandidates` + the subsequent `createPreview` call as specified, falls back to `entityCandidates: null`, logs with the same tag convention as the existing fire-and-forget catch (`[ingest_text] Error detecting entity candidates for source ${source.id}:`), and the final `return` with `source: { id, status }` is now unconditionally reached.
> - Out-of-scope respected: `packages/mcp/src/tools/errors.ts` and `packages/core/src/services/entity.service.ts` are untouched; no `list_sources`/`delete_source`/idempotency-key work added by this diff.
> - Test quality: the new test matches all four exit-condition assertions verbatim. Not theater.
> - No gate-stub needed since nothing from Scope was skipped.
> - Comment is a concise durable-WHY comment, appropriately references T-159 as a pointer.
> - No sprawl/DRY issue introduced.
>
> PASS-WITH-NOTES

Not remediated — a single line's type-verbosity nit, not a functional issue, and PASS-WITH-NOTES doesn't require a remediation pass per the routine.

## Efficiency notes

Straightforward run — the ticket's inlined root-cause analysis and exact Scope wording (which lines to wrap, what log-tag convention to reuse, what to fall back to) meant no exploration beyond the four named Context files was needed. The one snag was a Biome formatting nit on the new test's `await sourceService.getByIdUnscoped(...)` line, fixed with `biome check --write` before the full gate run.

**Retry log:** 0 retries against the iteration cap. One `mechanical_lint_typecheck`-category fix (the Biome formatting nit above), auto-applied via `biome check --write` rather than counted as a Red/Green iteration since it wasn't a Red/Green loop failure.

## Anything Alex must decide

None. The reviewer's one note (reuse `EntityCandidateProposal[]` instead of an inline `Awaited<ReturnType<...>>` type) is a harmless style nit left as-is per PASS-WITH-NOTES; happy to clean it up in a follow-up if you'd rather not carry it.
