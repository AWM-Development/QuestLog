---
name: tdd-loop
description: Red/green/refactor implementation loop for QuestLog tickets. Use whenever implementing a ticket's scope — every checkpoint starts with a failing test, not implementation code.
---

# TDD Loop

The implementation procedure for every ticket. QuestLog's CLAUDE.md rule is absolute: no implementation code before a failing test exists for the behavior it implements. This skill is the mechanical loop that enforces that, plus QuestLog-specific test conventions so you don't have to rediscover them per ticket.

## The loop, per checkpoint in the ticket's scope

1. **Red.** Write a test describing the behavior. Run it. Confirm it fails — and fails for the *right reason* (missing implementation, not a typo in the test itself). If it passes immediately, the test isn't testing anything — rewrite it.
2. **Green.** Write the minimum code to pass. Resist adding anything the test doesn't require yet — that's the next checkpoint's job, or out of scope entirely.
3. **Refactor.** With tests green, clean up: extract duplication, rename for clarity, simplify. Re-run tests after every refactor step. Never refactor and add behavior in the same step.
4. Move to the next checkpoint. Repeat.

## QuestLog test conventions

- **File placement:** tests live next to source. `foo.service.ts` → `foo.service.test.ts` (unit, mocked dependencies) or `foo.service.integration.test.ts` / router `*.integration.test.ts` (real test DB). Component tests: `Foo.tsx` → `Foo.test.tsx`.
- **Test DB isolation:** see `.claude/rules/db.md` and `.claude/rules/backend.md` for the `BEGIN`/`ROLLBACK` vs `deleteCampaignTree()` decision. Get this wrong and tests leak state into each other nondeterministically.
- **Never hit real external APIs.** Voyage and Anthropic calls are always injected (`fetchFn`, DI'd client) — see `.claude/rules/backend.md §Mocking external HTTP`. A ticket whose exit condition needs *real* embeddings (e.g. verifying actual retrieval quality) still injects a real API key through the same seam in an integration test explicitly marked as needing `VOYAGE_API_KEY` — it does not bypass the DI pattern to call `fetch` directly.
- **Coverage expectation:** 80%+ on service-layer business logic. Don't chase a global percentage — untested getters and trivial passthroughs don't need tests; branching logic, edge cases, and error paths do.
- **No `test.only` / `test.skip` left behind.** CI hard-fails on either. If you need to temporarily isolate a test while debugging, remove the modifier before committing.

## Before calling scope done

- Full ticket exit condition met — not just "tests exist," but the specific behavioral check(s) named in the ticket pass.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` all clean — paste the actual output, don't summarize it.
- No skipped/only tests, no `any`/`@ts-ignore` without a comment justifying why.
