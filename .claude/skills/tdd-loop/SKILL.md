---
name: tdd-loop
description: Red/green/refactor implementation loop for QuestLog tickets. Use whenever implementing a ticket's scope — every checkpoint starts with a failing test, not implementation code.
---

# TDD Loop

The implementation procedure for every ticket. QuestLog's AGENTS.md rule is absolute: no implementation code before a failing test exists for the behavior it implements. This skill is the mechanical loop that enforces that, plus QuestLog-specific test conventions so you don't have to rediscover them per ticket.

## The loop, per checkpoint in the ticket's scope

1. **Red.** Write a test describing the behavior. Run it. Confirm it fails — and fails for the *right reason* (missing implementation, not a typo in the test itself). If it passes immediately, the test isn't testing anything — rewrite it.
2. **Green.** Write the minimum code to pass. Resist adding anything the test doesn't require yet — that's the next checkpoint's job, or out of scope entirely.
3. **Refactor.** With tests green, clean up: extract duplication, rename for clarity, simplify. Re-run tests after every refactor step. Never refactor and add behavior in the same step.
4. Move to the next checkpoint. Repeat.

## QuestLog test conventions

- **File placement:** tests live next to source. `foo.service.ts` → `foo.service.test.ts`, whether the test mocks its dependencies or hits the real test DB — there is no separate `.integration.test.ts` suffix; the only naming split that matters is `*.e2e.test.ts` (real DB + real external API, excluded from the default tier). Component tests: `Foo.tsx` → `Foo.test.tsx`.
- **Test DB isolation:** see `.claude/rules/db.md` and `.claude/rules/backend.md` for the `BEGIN`/`ROLLBACK` vs `deleteCampaignTree()` decision. Get this wrong and tests leak state into each other nondeterministically.
- **Mocks are the default and the priority — write these first, and for almost every ticket, these are the only tests you need.** Voyage and Anthropic calls are always injected (`fetchFn`, DI'd client) — see `.claude/rules/backend.md §Mocking external HTTP`. Mocked tests are what CI actually gates merges on; they're fast, free, deterministic, and catch the bugs that matter for a given PR (wrong shape, bad error handling, wrong filtering). Reach for a mock every time unless you have a specific reason not to.
- **Real-API `.e2e.test.ts` tests are the occasional exception, not a per-ticket default.** They exist to answer a different question than the mocked suite does — "does the real model/account integration still work" — which is a fact about the vendor and the account, not about this PR's code, so it doesn't need re-proving on every commit. They run on `main`-push / on-demand (`.github/workflows/e2e-release-check.yml`, `pnpm test:e2e`), never as part of the default `pnpm test` / PR gate (see `Docs/IMPLEMENTATION_NOTES.md` for why — it was tried, and a shared per-vendor rate limit made it an unreliable merge gate). Only add a new one of these if you're genuinely proving a new real-API integration path for the first time, matching the existing pattern (`describe.skipIf(!process.env.VOYAGE_API_KEY)`, permanent fixture reuse, excluded from the default vitest config) — don't add one as a matter of course for every ticket that happens to touch an external API.
- **Coverage expectation:** 80%+ on service-layer business logic. Don't chase a global percentage — untested getters and trivial passthroughs don't need tests; branching logic, edge cases, and error paths do.
- **No `test.only` / `test.skip` left behind.** CI hard-fails on either. If you need to temporarily isolate a test while debugging, remove the modifier before committing.

## Before calling scope done

- Full ticket exit condition met — not just "tests exist," but the specific behavioral check(s) named in the ticket pass.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` all clean — paste the actual output, don't summarize it.
- No skipped/only tests, no `any`/`@ts-ignore` without a comment justifying why.
- **One DRY pass across the whole diff, not just each checkpoint's local refactor step.** Step 3's refactor only cleans up duplication within the checkpoint you're on — it won't catch the same pattern (a fixture literal, a resolve-then-guard pair, a helper) getting reintroduced in a different file two checkpoints later. Before finishing, grep the ticket's changed files for anything copy-pasted across more than one of them and consolidate.
