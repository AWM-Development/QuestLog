# T-118 — Reusable LLM structured-extraction call pattern

Milestone ref: Docs/milestones/MILESTONES_V1_3_MCP.md M-EXTRACT.4

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-extract/t-118-llm-structured-extraction-client-pattern

Context files (load ONLY these):
  - packages/core/src/services/llm.service.ts (`createLlmService(client?)` — the existing Anthropic SDK integration, DI'd for tests; conversation-shaped today (`callClaude`/`callClaudeStreaming`, free-text response) and not fit for structured/JSON output — this ticket evaluates extending it vs. extracting a lower-level primitive)
  - packages/core/src/services/voyage.client.ts (the precedent this ticket's pattern should match: one shared, injectable client per external vendor concern, used by more than one service, rather than each caller rolling its own HTTP/SDK setup)
  - packages/core/src/lib/errors.ts (`LlmApiError` — reuse this error type; do not introduce a second one)
  - .claude/rules/backend.md ("Mocking external HTTP (Voyage, Anthropic)" section — the DI/mocking convention this ticket's new surface must follow: injectable client override, no live network calls in `*.test.ts`, no second HTTP client per vendor)
  - packages/core/src/usage-capture/pricing.ts (existing token-cost accounting — check whether the new call path should feed the same usage-tracking mechanism `conversation.service.ts` already uses, so a new LLM call site isn't invisible to cost observability)

Scope: Add one reusable, DI-testable function for making a single structured-output (tool-use / JSON-schema-constrained) call to Claude, callable from any future core service without each call site rolling its own Anthropic SDK plumbing — the same role `voyage.client.ts` plays for embeddings. Concretely: evaluate `llm.service.ts`'s existing `createLlmService(client?)` DI pattern and either (a) add a new method to it (e.g. `callClaudeStructured`) alongside the existing conversational methods, or (b) extract a lower-level shared primitive both the existing conversational path and this new structured path call into — pick whichever avoids duplicating the Anthropic client construction/error-wrapping logic that already exists in `llm.service.ts`, and record which was chosen and why in `IMPLEMENTATION_NOTES.md`. The new function accepts a caller-supplied JSON schema (or Zod schema translated to one) and a prompt/input text, and returns a parsed, typed result (or throws `LlmApiError` on failure/malformed output) — no conversation history, no streaming, no system-prompt-building concerns from `buildSystemPrompt`. Must be injectable with a mock Anthropic client in tests, per `.claude/rules/backend.md`. This ticket does not wire the new function into entity extraction or any other feature — it exists standalone, proven by its own unit tests (mocked client, fixture schema) so T-119 can consume it directly.

Out of scope: Wiring this into entity-candidate detection or `ingest_text` (T-119, blocked on this ticket). Any change to `conversation.service.ts`'s existing chat behavior. Model selection tuning (reuse `LLM_CONFIG.model` or a documented override — do not add a model-selection framework). Retry/backoff logic beyond what `llm.service.ts` already has via `wrapError`/`LlmApiError`. Wiring into the token-cost observability pipeline if the evaluation in Context files concludes it's out of scope for a first cut — note the gap in `IMPLEMENTATION_NOTES.md` instead of building it speculatively.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - given a mocked Anthropic client returning a valid tool-use response matching a fixture JSON schema, the new function returns the parsed, typed result
  - given a mocked client returning a malformed/non-conforming response, the new function throws `LlmApiError` rather than returning a partial or `any`-typed result
  - no test in the new function's suite makes a real network call (mirrors the existing `llm.service.test.ts`/`voyage.client.test.ts` mocking convention)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_3_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
