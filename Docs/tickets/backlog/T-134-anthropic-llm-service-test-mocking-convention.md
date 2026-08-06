# T-134 — Reconcile `llm.service.ts`'s DI factory with how its tests actually mock Anthropic

Milestone ref: cross-cutting audit finding (T-132, Dimension 1/2 — MCP tool/service
  pattern consistency & rules-file accuracy)

Complexity tier: S

Strategy-gate flag: no

Priority: P2

Branch: chore/m-audit/t-134-llm-service-test-mocking-convention

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

Mockup: none

Model: sonnet

Scope: Pick one direction and make the doc and code agree:
  1. **Either** refactor `llm.service.test.ts` to inject a mock client via
     `createLlmService(mockClient)`, matching Voyage's `fetchFn` DI
     pattern and the rule as currently written — the DI parameter then
     has a real reason to exist beyond looking parallel to Voyage's shape;
  2. **or** update `.claude/rules/backend.md`'s Anthropic bullet to
     describe module-level `vi.mock` as the actual convention, and decide
     whether `createLlmService`'s optional `client` parameter should be
     kept (documented as available for a future non-test caller) or
     removed as unused surface.
  Alex's call which direction — this ticket exists to force the decision,
  not to presume DI is obviously better just because Voyage does it that
  way (Voyage's `fetchFn` swaps a plain function; swapping an entire SDK
  client instance is a heavier ask for each test file to construct).

Out of scope: Any other service's external-API mocking pattern — this
  ticket is scoped to the one concrete Anthropic/`llm.service.ts`
  inconsistency found.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `.claude/rules/backend.md`'s Anthropic-mocking bullet and
    `llm.service.test.ts`'s actual mocking mechanism agree with each
    other (whichever direction was chosen)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_MCP.md
  if applicable (likely N/A — this is a cross-cutting audit follow-up, not
  a milestone task; mark N/A if so), IMPLEMENTATION_NOTES.md updated
  recording which direction was chosen and why, a CHANGELOG.md entry
  under [Unreleased] only if test behavior changed, morning report written.
