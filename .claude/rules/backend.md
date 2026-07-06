---
paths:
  - "apps/server/**"
---

<!-- Mirrored to .cursor/rules/backend.mdc — edit here first, then copy the body (not frontmatter) over. Do not edit the .mdc directly. -->

# Backend conventions (`apps/server`)

## Router → Service → Drizzle

Routers (`src/routers/*.ts`) are thin: validate input with a Zod schema (imported from `@questlog/shared` when the shape is cross-app, local otherwise), call one service method, return its result. No business logic in a router handler.

```ts
export const sessionRouter = router({
  create: procedure.input(CreateSessionInput).mutation(({ ctx, input }) =>
    withErrorHandling(() => sessionService.create(ctx.db, input)),
  ),
});
```

Services (`src/services/*.service.ts`) own business logic, receive the `Database` instance as their first argument (not imported as a module-level singleton — this is what makes `createTestDb()` swappable in tests), and throw typed errors (`lib/errors.ts`: `NotFoundError`, `ValidationError`, etc.) rather than returning null/undefined for failure. `withErrorHandling` in `trpc.ts` maps typed errors to tRPC error codes — add new mappings there, not ad hoc in a router.

## Zod conventions

Every tRPC input has a Zod schema. Shapes shared with the frontend live in `packages/shared/src/validators/`; shapes local to one router can stay in the router file. Never accept unvalidated `input: any`.

## Test DB pattern

Two isolation strategies, pick based on whether the code under test opens its own `db.transaction()`:

- **Default:** wrap each test in `BEGIN`/`ROLLBACK` (`beforeEach`/`afterEach`), using `createTestDb()` from `src/db/test-helpers.ts`.
- **Code under test calls `db.transaction()` itself** (e.g. `conversation.service.ts` chat path): a nested raw `BEGIN` doesn't compose with Drizzle's transaction handling. Use `deleteCampaignTree()` (also in `test-helpers.ts`) for explicit FK-safe cleanup instead.

The test DB (`questlog_test` on `:5433`) must be migrated before running tests — `global-setup.ts` only truncates, it does not run migrations. If a test fails with a missing-column error, run `db:migrate` against `questlog_test` first.

## Mocking external HTTP (Voyage, Anthropic)

Every function that calls an external API accepts an injectable override — `fetchFn` for Voyage (`voyage.client.ts`), a DI'd client for Anthropic (`createLlmService(client?)` in `llm.service.ts`). Tests always inject a mock; never patch `process.env` or hit the network in a test. Do not add a second HTTP client for either provider — everything Voyage-related goes through `voyage.client.ts`.
