# QuestLog — Implementation Notes

**Location:** `Docs/IMPLEMENTATION_NOTES.md`

**Purpose:** A running log of non-obvious implementation decisions, gotchas, and things future AI agents (and future-you) need to know before touching the codebase. This is for information that *isn't* derivable from reading the code and *isn't* in the PRD.

Read this at the start of every coding session. Add to it when you make a non-obvious decision.

**Related Docs:**
- `Docs/DEVELOPMENT_GUIDE.md` — Coding conventions and patterns
- `Docs/PRD.md` — Product specification

**Last Updated:** 2026-03-15

---

## Tooling & Environment

### pnpm requires corepack activation
pnpm is not installed globally — it runs via corepack. If `pnpm` is not on PATH, run:
```bash
corepack enable pnpm
```
You may also need to source nvm first: `. ~/.nvm/nvm.sh && corepack enable pnpm`

### Biome is the sole linter + formatter
No ESLint, no Prettier. Biome handles both. Config is at root `biome.json`.
- **Indentation:** tabs (not spaces)
- **Quotes:** double
- **Semicolons:** always
Run auto-fix with: `pnpm exec biome check --write .` inside a package directory.

### Run lint/test/typecheck from repo root
Always use `pnpm turbo <task>` from the repo root. Running scripts inside individual packages may miss cross-package issues and won't benefit from turbo caching.

---

## TypeScript & Module Resolution

### `.js` extensions in imports are intentional
All TypeScript source files use `.js` extensions in imports (e.g., `import { foo } from "./bar.js"`). This is the correct pattern for ESM with `moduleResolution: "bundler"`. TypeScript resolves `.js` → `.ts` at type-check time; the extension is needed for correct Node.js ESM resolution at runtime.

Do not remove `.js` extensions from imports.

### `packages/shared` has no build step — intentional
`@questlog/shared` exports raw TypeScript source via `"main": "./src/index.ts"`. Both Vite (web) and tsx (server) can consume TypeScript directly through the `workspace:*` protocol, so no compilation is needed. If this package ever needs to be published externally, add a `build` script then.

### Tailwind CSS v4 — no config file needed
The project uses Tailwind v4 (`@tailwindcss/vite`). The v4 API uses `@import "tailwindcss"` in CSS instead of `tailwind.config.js`. Do not create `tailwind.config.js` — it's not used in v4.

---

## Architecture Decisions

### Shared package exports structure
`packages/shared/src/` has three sub-modules:
- `types/` — TypeScript interfaces and type aliases
- `validators/` — Zod schemas (input validation, shared between frontend and backend)
- `constants/` — Shared constant values

When adding a new shared type, put it in the most specific sub-module. Don't dump everything into `index.ts` directly.

### `buildApp()` factory pattern on server
`apps/server/src/server.ts` exports `buildApp()` instead of a singleton app instance. This is deliberate — it allows `vitest` tests to create fresh app instances per test without shared state or port conflicts. Do not change this to a singleton.

### tRPC is installed but not yet wired up (task 1.3)
`@trpc/server` is in `apps/server/package.json` as a dependency. The tRPC context, root router, and Fastify plugin will be added in milestone task 1.3 (`feat/foundation/trpc-campaign-crud`). The package is not a dead dependency.

---

## Testing

### Vitest globals are enabled
Both `apps/server/vitest.config.ts` and `apps/web/vitest.config.ts` set `globals: true`. You do not need to import `describe`, `it`, `expect`, etc. — they are available globally. Import them explicitly anyway if Biome flags missing imports (some lint rules require it).

### Web tests use jsdom environment
`apps/web/vitest.config.ts` sets `environment: "jsdom"`. This means DOM APIs are available in web tests without a real browser. The setup file `src/test-setup.ts` imports `@testing-library/jest-dom/vitest` to add custom matchers like `toBeInTheDocument()`.

### Server tests use Fastify's `inject()`
Server tests call `app.inject({ method, url })` instead of making real HTTP requests. This exercises the full Fastify request lifecycle without binding to a port. Keep this pattern — it's fast and avoids port conflicts in CI.

---

## Known Gaps (Deferred to Future Tasks)

| Gap | Planned In |
|---|---|
| Database connection (Drizzle + Postgres) | Task 1.2 |
| tRPC router + context factory | Task 1.3 |
| Frontend tRPC client (React Query provider) | Task 1.3 |
| React Router + layout shell | Task 1.4 |
| Environment variable runtime validation | Task 1.3 (alongside server context) |
| Error boundaries in React | Task 1.4 |

---

*Add a new entry any time you make a non-obvious decision. Include the date and the task branch it was made on.*
