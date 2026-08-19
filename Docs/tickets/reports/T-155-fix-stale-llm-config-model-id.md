# T-155 — Fix stale `LLM_CONFIG.model` breaking `ingest_text` on prod

**Outcome:** shipped
**Branch:** feat/m-bug/t-155-fix-stale-llm-config-model-id
**Diff:** 3 files changed, +8/-3 lines
**Complexity tier:** S
**Strategy-gate flag:** no

## What shipped

`packages/core/src/services/llm.service.ts`'s `LLM_CONFIG.model` now points at `claude-sonnet-5` instead of the decommissioned `claude-sonnet-4-20250514`. Since every LLM-calling method in that file (`callClaude`, `callClaudeStreaming`, `callClaudeStructured`) reads this one shared constant, this fixes `ingest_text`'s entity-candidate extraction (the reported prod failure) and every other caller of `llmService` (`conversation.service.ts`'s chat path) in the same commit.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (836 passed)
```

`llm.service.test.ts` alone:

```
 RUN  v3.2.4 /Users/alexandermeyer/Documents/Code/QuestLog/tmp/worktrees/T-155/packages/core

 ✓ |core| src/services/llm.service.test.ts (24 tests) 5ms

 Test Files  1 passed (1)
      Tests  24 passed (24)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — `scripts/run-tests-quiet.sh` output pasted above.
- **`llm.service.test.ts` proves the model string sent to the mocked Anthropic client is `"claude-sonnet-5"`, not the old value** — the pre-existing "uses the correct model" test only matched `/claude/`, loose enough to have let the stale id through unnoticed; strengthened to `uses the current, non-decommissioned model`, asserting `callArgs.model === "claude-sonnet-5"` exactly (`packages/core/src/services/llm.service.test.ts:255-271`). Deliberately pinned against the literal string, not `LLM_CONFIG.model` itself — comparing against the constant under test would trivially pass even if that constant regressed back to the old value.
- **Repo-wide grep for `claude-sonnet-4-20250514` (excluding `dist/` and this ticket file) returns no matches** — verified:
  ```
  $ grep -rn "claude-sonnet-4-20250514" packages/ apps/ | grep -v node_modules | grep -v dist/
  (no output)
  ```
- **Manual prod verification — deferred to Alex, as the ticket specified.** This needs the live deployed service, which isn't reachable from this run. Once this PR merges and deploys, re-run the exact repro from the original bug report (`ingest_text` with a trivial `content` string against a valid `campaignId` on QuestLog prod) and confirm no `404 not_found_error`.

## Reviewer verdict

**PASS.**

> All tests pass. The change is a precise one-line fix plus a test tightened from a loose regex match to an exact pin — a real improvement (not theater; it was theater before, now it's a genuine regression guard). No scope creep — no changes to `maxTokens`, `wrapError`, `voyage.client.ts`, or any env-configurable refactor. The comment at `llm.service.test.ts:264-268` is a bit long but does carry durable WHY (explains why pinning to the literal instead of `LLM_CONFIG.model` matters) rather than restating the code — acceptable, though borderline on length.
>
> Findings:
> - `packages/core/src/services/llm.service.test.ts:264-268` — comment is four lines for a one-line assertion change; slightly verbose but content is legitimate WHY-not-WHAT (justifies not asserting against `LLM_CONFIG.model` itself, which is a real correctness point, not restated code). Not blocking.
>
> Scope, out-of-scope, and exit-condition items all verified: single-line model change, only caller reads the shared constant (confirmed via grep — `entity.service.ts` and `conversation.service.ts` both go through `llmService`, no second hardcoded string), repo-wide grep for the old string returns zero matches, and the test now asserts the exact new model string rather than a loose pattern.

## Efficiency notes

Straightforward, in-scope run — no false starts. The one deviation from a pure one-line diff: the pre-existing "uses the correct model" test's `/claude/` regex was loose enough that it would have silently passed even with the old stale id still in place, so it was rewritten into a real regression guard rather than left as-is (a genuine gap the ticket's own exit condition called out, not scope creep).

**Retry log:** 1 retry — not against the ticket cap (this was catching my own bug in the new test, not the fix itself): the first version of the strengthened test asserted `callArgs.model === LLM_CONFIG.model`, which is self-referential and would trivially pass even under a future regression of that same constant. Caught on review before committing; rewritten to assert against the literal `"claude-sonnet-5"` string instead. Categorized `mechanical_lint_typecheck`-adjacent (a test-design correctness issue, not a genuine bug in the shipped code).

## Anything Alex must decide

- **Manual prod re-verification**, per the ticket's own exit condition — re-run the original `ingest_text` repro against prod once this deploys, to close the loop on the actual reported symptom.
- **Dev environment** was never confirmed to share the bug (project policy is prod-only testing) — this fix applies to both, since `LLM_CONFIG.model` isn't environment-specific, but worth a quick dev-side sanity check if convenient.
- Out of scope, flagged for a possible future ticket if wanted: making `LLM_CONFIG.model` env-configurable or version-pinned, so a future model deprecation doesn't require a code change to notice/fix. Not attempted here — the ticket's Out of scope explicitly deferred this as its own design decision.
