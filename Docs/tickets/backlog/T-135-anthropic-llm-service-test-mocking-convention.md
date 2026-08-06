# T-135 — Refactor `llm.service.test.ts` to use `createLlmService`'s DI parameter

Milestone ref: cross-cutting audit finding (T-132, Dimension 1/2 — MCP tool/service
  pattern consistency & rules-file accuracy)

Complexity tier: S

Strategy-gate flag: no

Priority: P2

Branch: chore/m-audit/t-135-llm-service-test-mocking-convention

Context files (load ONLY these):
  - packages/core/src/services/llm.service.ts (`createLlmService(client?)`,
    line ~95, and the `export const llmService = createLlmService();`
    singleton, line ~221)
  - packages/core/src/services/llm.service.test.ts (top-of-file
    `vi.mock("@anthropic-ai/sdk", ...)` block)
  - packages/core/src/services/embedding.service.ts /
    embedding.service.test.ts (the `fetchFn` DI pattern Voyage tests
    actually exercise — the comparison case)
  - .claude/rules/backend.md § "Mocking external HTTP (Voyage, Anthropic)"

## Relevant background

`.claude/rules/backend.md` documents the convention as: "a DI'd client for
Anthropic (`createLlmService(client?)` in `llm.service.ts`)" — implying
tests inject a mock `Anthropic` client through that factory's optional
parameter, the same way Voyage tests inject `fetchFn`. In practice,
`createLlmService(client?)`'s optional parameter is never exercised
anywhere in the codebase — the only call site is the parameterless
`llmService = createLlmService()` singleton — and
`llm.service.test.ts` instead mocks the entire `@anthropic-ai/sdk` module
at the top of the file via `vi.mock(...)`. Both approaches keep network
calls out of the default test tier (no rule violation), but they're two
different mechanisms for the same job, and the rules doc describes the
one that isn't actually used.

**Decided (2026-08-06, Alex):** refactor the test to use the DI parameter,
not the doc. The rule stays as currently written — no doc change needed
here, only code.

Mockup: none

Model: sonnet

Scope: Refactor `llm.service.test.ts` to construct
  `createLlmService(mockClient)` with a hand-built mock `Anthropic`-shaped
  client (`{ messages: { create: mockCreate, stream: mockStream } }`,
  reusing the same `mockCreate`/`mockStream` fns the file already
  `vi.hoisted`s) instead of `vi.mock("@anthropic-ai/sdk", ...)`ing the
  whole module. Every test in the file should exercise the DI'd instance
  (`createLlmService(mockClient).callClaude(...)` etc.) rather than the
  module-level `llmService` singleton, matching how
  `embedding.service.test.ts` calls `embedChunks(db, chunks, { fetchFn:
  mockFetch })` per-test rather than patching a module-level default.
  Remove the `vi.mock("@anthropic-ai/sdk")` block once nothing depends on
  it. Keep the existing `Anthropic.APIError` mock subclass (or an
  equivalent) available for the tests that construct one to assert
  error-mapping behavior — it's still needed as a value, just no longer
  needs to arrive via a full module mock.

Out of scope: Any other service's external-API mocking pattern — this
  ticket is scoped to the one concrete Anthropic/`llm.service.ts`
  inconsistency found. No change to `.claude/rules/backend.md`'s
  Anthropic-mocking bullet — it already describes the target state this
  ticket implements.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `llm.service.test.ts` contains no `vi.mock("@anthropic-ai/sdk", ...)`
    call; every test constructs its own `createLlmService(mockClient)`
  - `.claude/rules/backend.md`'s Anthropic-mocking bullet now accurately
    describes the test file's actual mechanism (it already does — this
    is a regression check, not a doc edit)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_MCP.md
  — N/A, this is a cross-cutting audit follow-up, not a milestone task,
  IMPLEMENTATION_NOTES.md updated noting the DI refactor and that Alex
  chose it over the doc-update alternative T-132 also offered, no
  CHANGELOG.md entry required (test-only change, no shipped behavior
  change), morning report written.
