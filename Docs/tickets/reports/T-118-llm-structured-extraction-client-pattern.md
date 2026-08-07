# T-118 — Reusable LLM structured-extraction call pattern

**Outcome:** shipped
**Branch:** feat/m-extract/t-118-llm-structured-extraction-client-pattern
**Diff:** 6 files changed, +256/-1 lines
**Complexity tier:** M
**Strategy-gate flag:** yes

## What shipped

`llm.service.ts`'s `createLlmService(client?)` gains a new `callClaudeStructured<T>` method: a single, DI-testable call that forces Claude to respond via a caller-supplied JSON schema (a `tool_choice`-forced tool call) and returns the parsed, typed result — throwing `LlmApiError` on a missing or non-object tool response. It exists standalone, with its own unit test suite, ready for `T-119` or any future structured-extraction call site to consume directly.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (808 passed)
```

(`scripts/run-tests-quiet.sh` output, run from the worktree root — full per-stage logs under `tmp/test-logs/`.)

`llm.service.test.ts`-only run, showing the new suite specifically:

```
 ✓ |core| src/services/llm.service.test.ts (24 tests) 5ms

 Test Files  1 passed (1)
      Tests  24 passed (24)
```

`tsc --noEmit` via `pnpm typecheck` (turbo, all 8 packages): all tasks successful, `@questlog/core:typecheck` cache miss (freshly executed, not stale-cached from before this diff).

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see Test evidence above (808 passed, 0 lint warnings, typecheck pass across all packages).
- **Given a mocked Anthropic client returning a valid tool-use response matching a fixture JSON schema, the new function returns the parsed, typed result** — `llm.service.test.ts:438` (`"returns the parsed, typed result for a valid tool-use response"`), asserting `result.data` equals the fixture NPC object and `result.usage` equals the mocked token counts.
- **Given a mocked client returning a malformed/non-conforming response, the new function throws `LlmApiError` rather than returning a partial or `any`-typed result** — two cases: `llm.service.test.ts:502` (no matching `tool_use` block in the response) and `llm.service.test.ts:518` (`tool_use` block present but `input` is a string, not an object) — both assert `.rejects.toThrow(LlmApiError)`.
- **No test in the new function's suite makes a real network call** — the suite reuses the file's existing module-level `vi.mock("@anthropic-ai/sdk", ...)` (no network-capable client ever constructed), plus an explicit guard test (`llm.service.test.ts:556`) asserting `mockCreate` is a mock function, as a cheap trip-wire against that wiring silently breaking.

## Reviewer verdict

PASS — full verbatim verdict from the `reviewer` subagent:

> Reviewed `packages/core/src/services/llm.service.ts:47-284` (new `CallClaudeStructuredInput`/`CallClaudeStructuredResult` types and `callClaudeStructured` method) and `packages/core/src/services/llm.service.test.ts:429-562` (new test suite), plus `Docs/IMPLEMENTATION_NOTES.md:875-885`, `CHANGELOG.md:13-15`, and `Docs/milestones/MILESTONES_V1_3_MCP.md:77`.
>
> **Pattern compliance (backend.md):** The new method is added to the existing `createLlmService(client?)` factory rather than a second HTTP client, reuses the injected `anthropic` client and existing `wrapError`/`LlmApiError` handling (`llm.service.ts:279-283`), and the test suite mocks the SDK at module level with no live network call (`llm.service.test.ts:40-63`, explicit guard at `llm.service.test.ts:556-561`). Matches the DI/mocking convention required by `.claude/rules/backend.md`.
>
> **Exit condition:** All four machine-checkable items are met — valid tool-use response returns parsed typed result (`llm.service.test.ts:438-463`), malformed input (non-object) throws `LlmApiError` (`llm.service.test.ts:518-539`), no matching tool_use block throws `LlmApiError` (`llm.service.test.ts:502-516`), and no test hits the network. Ran `vitest run` locally: 24/24 pass. `tsc --noEmit` clean.
>
> **Scope:** The choice between extending `llm.service.ts` vs. extracting a primitive is made and justified in `Docs/IMPLEMENTATION_NOTES.md:877-878`, matching the ticket's requirement to record which was chosen and why. No wiring into `ingest_text`/entity extraction (correctly out of scope). No changes to `conversation.service.ts`'s chat behavior. Token-cost observability gap explicitly noted rather than built (`Docs/IMPLEMENTATION_NOTES.md:883`), per the ticket's own carve-out for that case.
>
> **Test quality:** Assertions are concrete (exact object equality on parsed data/usage, exact `tool_choice`/`tools` payload shape at `llm.service.test.ts:485-496`), not theater.
>
> **Diff footprint:** Only `llm.service.ts`/`llm.service.test.ts` plus the expected bookkeeping files changed — no scope creep into unrelated files.
>
> **Comment discipline:** Comments on the new code (`llm.service.ts:49-55`, `220-225`) state durable design rationale (why JSON schema not Zod, why tool_choice forcing) concisely, not restating what the code does or narrating the ticket. IMPLEMENTATION_NOTES entry captures the fuller rationale once; comments in code don't duplicate it in full prose.
>
> One very minor nit, not blocking: `llm.service.ts:57` comment ("Tool name Claude is forced to call; also identifies the schema in the response") is fine but slightly redundant with the doc comment on `CallClaudeStructuredInput` just above it (`llm.service.ts:49-55`) which already explains `tool_choice` forcing — not duplication across files, just two adjacent comments covering overlapping ground. Not worth a remediation pass on its own.
>
> No functionality gaps, no scope creep, no test theater, no DRY violations introduced by this diff.
>
> PASS

## Efficiency notes

Ran tight — the ticket's Context files fully covered what was needed (existing `llm.service.ts`/`voyage.client.ts` DI patterns, `errors.ts`, `backend.md`'s mocking convention, `pricing.ts` for the cost-observability question). The only extra research was reading the Anthropic SDK's own `.d.ts` (`ToolUseBlock`, `Tool.InputSchema`, `ToolChoiceTool`) directly from `node_modules`, since this codebase had no prior tool-use/structured-output precedent to copy from — a one-time lookup, not a retry. No blocking failures; TDD loop was Red (5 failing tests, `callClaudeStructured is not a function`) → Green (all 24 pass) in one pass.

**Retry log:** 0 retries.

## Anything Alex must decide

None. The one open design question the ticket flagged — extend `llm.service.ts` vs. extract a primitive — was resolved in-ticket per its own Scope guidance (extend; see `IMPLEMENTATION_NOTES.md` § T-118) rather than deferred. The ticket's `Strategy-gate flag: yes` reflects that this design question existed, not an unresolved 🧠 gate in the ticket body itself — none was present, so no `G-###` was filed.
