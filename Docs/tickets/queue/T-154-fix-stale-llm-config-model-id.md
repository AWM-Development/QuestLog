# T-154 — Fix stale `LLM_CONFIG.model` breaking `ingest_text` on prod

Milestone ref: M-BUG.1 (`Docs/milestones/MILESTONES_BUGS.md`)

Complexity tier: S

Strategy-gate flag: no

Priority: P0

Branch: feat/m-bug/t-154-fix-stale-llm-config-model-id

Context files (load ONLY these):
  - packages/core/src/services/llm.service.ts (`LLM_CONFIG` at lines ~25-32; the string being replaced is used at all three call sites in this file — `callClaude`, `callClaudeStreaming`, `callClaudeStructured`)
  - packages/core/src/services/llm.service.test.ts (confirm no test hardcodes the old model string; none currently do, but re-check before/after)
  - packages/core/src/services/entity.service.ts (`detectCandidates`, lines ~385-410 — the `callClaudeStructured` call on `ingest_text`'s entity-candidate-extraction path; confirms the bug's reported symptom traces to this single config value, not a second hardcoded string)
  - CHANGELOG.md (entry format for `[Unreleased]`)

## Relevant background
Bug reported by Alex from live testing against QuestLog (prod), 2026-08-10: every `ingest_text` call fails immediately with

```
404 {"type":"error","error":{"type":"not_found_error","message":"model: claude-sonnet-4-20250514"},"request_id":"req_011CduerTS2xAicopkhBfXXr"}
```

reproduced on 3 consecutive attempts (`req_011CduerTS2xAicopkhBfXXr`, `req_011CduetFobdw7ZgL7B8m3ka`, `req_011CdueyCqteF1iq6cZMQoz6`), with both a full ~1,500-word document and a one-line placeholder string as `content` — ruling out payload size/content as the cause. `list_campaigns`, `create_campaign`, and `get_source_status` all behaved normally in the same session (`get_source_status` correctly returned `NOT_FOUND` for a bogus `sourceId`), confirming the service is otherwise reachable and healthy, and that the failure is scoped to whichever LLM call `ingest_text` triggers internally.

Root cause, confirmed by reading the code: `packages/core/src/services/llm.service.ts` hardcodes `LLM_CONFIG.model = "claude-sonnet-4-20250514"` — a Claude model ID that has since been decommissioned server-side (`404 not_found_error`, not a client-side/request-shape problem). Every one of `llmService`'s three call methods (`callClaude`, `callClaudeStreaming`, `callClaudeStructured`) reads this same constant; there is no second, independently-hardcoded model string anywhere else in the codebase (`grep`-confirmed — `voyage.client.ts`'s `EMBEDDING_MODEL` is Voyage's embedding model, unrelated). `ingest_text`'s entity-candidate-extraction step (`entity.service.ts`'s `detectCandidates`) calls `callClaudeStructured`, which is why `ingest_text` fails while lookup-only tools (`list_campaigns`, `get_source_status`) — which never call the LLM service — don't.

Dev was not tested (project policy is prod-only per `AGENTS.md`), so whether dev shares this stale value is unconfirmed — dev and prod both build from the same `packages/core` source, so dev almost certainly has the identical bug; this ticket's fix applies to both since there is only one `LLM_CONFIG.model` value in the codebase, not an environment-specific one.

Current valid replacement, per Anthropic's own model-migration guidance (`claude-sonnet-4-20250514` is listed there as deprecated, retiring 2026-06-15, with `claude-sonnet-5` as its direct replacement — same tier, same intended use as the original choice): `claude-sonnet-5`.

Mockup: none

Runner: claude-code

Model: sonnet

Scope: In `packages/core/src/services/llm.service.ts`, change `LLM_CONFIG.model` from `"claude-sonnet-4-20250514"` to `"claude-sonnet-5"`. Since every LLM-calling method in this file reads the same `LLM_CONFIG.model` constant, this one-line change fixes `ingest_text`'s entity-candidate extraction (`entity.service.ts`) and every other caller of `llmService` (`conversation.service.ts`'s chat path) in the same commit — confirm via `grep` that no other file hardcodes the old model string before closing this out. Add or extend a `llm.service.test.ts` assertion that the request payload passed to the injected Anthropic client carries the new model string, so a future regression back to a stale ID fails a test instead of surfacing only in prod.

Out of scope: Any change to `maxTokens`, `maxHistoryMessages`, or any other `LLM_CONFIG` field. Any refactor of `LLM_CONFIG` into an env-configurable value, a per-environment override, or a versioned/pinned-model strategy — that's a real design decision (which model, how it's kept current, whether dev/prod should ever diverge) deserving its own ticket if Alex wants it, not folded into this one-line fix. Any change to `voyage.client.ts`'s `EMBEDDING_MODEL` — that's Voyage's embedding model, a different vendor and a different bug class, not implicated by this report. Any change to error handling/wrapping in `llm.service.ts`'s `wrapError` — the 404 was correctly surfaced as an `LlmApiError`; nothing about the error-translation path is broken.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `packages/core/src/services/llm.service.test.ts` (or a new assertion within it) proves the model string sent to the (mocked) Anthropic client is `"claude-sonnet-5"`, not the old value
  - a repo-wide `grep -rn "claude-sonnet-4-20250514" packages/ apps/` (excluding `dist/` build output and this ticket file itself) returns no matches
  - manual verification deferred to Alex post-merge, since it needs the live deployed service: once this PR ships to prod, re-run the exact repro from the bug report (`ingest_text` with a trivial `content` string against a valid `campaignId`) and confirm no `404 not_found_error` — note this step explicitly in the PR/report rather than claiming it as verified pre-merge

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_BUGS.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
