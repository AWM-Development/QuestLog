# QuestLog — Implementation Notes

**Location:** `Docs/IMPLEMENTATION_NOTES.md`

**Purpose:** A running log of non-obvious implementation decisions, gotchas, and things future AI agents (and future-you) need to know before touching the codebase. This is for information that *isn't* derivable from reading the code and *isn't* in the PRD.

Read this at the start of every coding session. Add to it when you make a non-obvious decision.

**Related Docs:**
- `Docs/DEVELOPMENT_GUIDE.md` — Coding conventions and patterns
- `Docs/PRD.md` — Product specification
- `Docs/DESIGN_SYSTEM.md` — Visual design spec (color tokens, components, entity system)

**Last Updated:** 2026-03-15 (design system overhaul)

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

### `.js` extensions in imports are intentional (not a workaround)
All TypeScript source files use `.js` extensions in imports (e.g., `import { foo } from "./bar.js"`). This is the correct, standard pattern for TypeScript with `moduleResolution: "bundler"` targeting Node.js ESM. TypeScript resolves `.js` → `.ts` at type-check time; the `.js` extension is what Node.js needs at runtime after compilation.

Do not remove `.js` extensions from imports. Do not "fix" them to `.ts` or extensionless.

### `packages/shared` has no build step — intentional
`@questlog/shared` exports raw TypeScript source via `"main": "./src/index.ts"`. Both Vite (web) and tsx (server) can consume TypeScript directly through the `workspace:*` protocol, so no compilation is needed. If this package ever needs to be published externally, add a `build` script then.

### Tailwind CSS v4 — no config file needed
The project uses Tailwind v4 (`@tailwindcss/vite`). The v4 API uses `@import "tailwindcss"` in CSS instead of `tailwind.config.js`. Do not create `tailwind.config.js` — it's not used in v4.

---

## Database

### postgres.js is the Postgres driver
We use `postgres` (postgres.js) as the Drizzle driver, not `pg` (node-postgres). postgres.js is ESM-native, has better performance, and simpler connection handling. The `drizzle-orm/postgres-js` adapter is used.

### Docker Postgres runs on port 5433
The Docker Compose pgvector container maps `5433:5432` to avoid conflicts with any local Postgres on the default port 5432. All connection strings (`.env`, test helpers, drizzle config) use port 5433.

### Import pipeline: storage and worker (task 2.1)
- **Storage:** Uploads use a pluggable `StorageProvider`; default is local filesystem via `UPLOAD_PATH` (default `uploads/`). Use `createMemoryStorage()` in tests. Swap for S3 later without changing import service.
- **Worker:** Pending sources are processed by running `pnpm run process-imports` (or set up a cron). No queue table; status on `sources` drives polling. `processSource` is idempotent for re-runs.
- **Sources schema:** `sources` has `mimeType`, `storageKey`; extracted text and extraction errors live in `metadata.extractedText` / `metadata.extractionError`. Migration: `0001_add_sources_mime_storage.sql`. Apply with `pnpm db:push` (dev) or run migrations for deploy.

---

## TypeScript & Module Resolution (continued)

### TypeScript project references for cross-package imports
When `@questlog/shared` began exporting real code (Zod validators), TypeScript's `rootDir` constraint caused TS6059 errors because resolved source files are outside `./src`. This is solved with **TypeScript project references** — the proper approach, not a workaround. Each package sets `composite: true` in its `tsconfig.json`, and consuming packages declare `references` to their dependencies. Typecheck uses `tsc -b` (build mode) which respects project boundaries. Note: `tsc -b --noEmit` is incompatible with `composite` (TS6310), so `tsc -b` emits `.js`/`.d.ts` to each package's `dist/` directory (gitignored). The web app imports the server's `AppRouter` type via a paths alias (`@questlog/server/*`) backed by a project reference — not a relative path.

### superjson transformer on both client and server
Both the tRPC server (`trpc.ts`) and client (`apps/web/src/lib/trpc.ts`) use superjson as the data transformer. This enables `Date` objects from Drizzle to serialize/deserialize correctly across the wire. Both sides must agree on the transformer — do not remove it from either.

### Frontend tRPC URL via `VITE_API_URL` env var
`apps/web/src/lib/trpc.ts` reads `import.meta.env.VITE_API_URL` for the tRPC endpoint URL. Set this in `.env.local` for development (e.g., `VITE_API_URL=http://localhost:3000/trpc`). The type is declared in `apps/web/src/vite-env.d.ts`. Runtime validation of env vars is deferred to task 1.4+.

---

## Frontend

### Design system overhaul (2026-03-15) — entity-driven color system
The original parchment/amber/brown palette (task 1.4) has been replaced with an entity-driven color system. The canonical reference is `Docs/DESIGN_SYSTEM.md`. Key changes:

- **New palette:** Deep navy-black base with cool blue-green entity accent colors. No more brown/amber.
- **Depth system:** Four surface planes (void → surface → elevated → focal) replace the old two-level bg-primary/bg-secondary split.
- **Entity colors are the accent system:** There is no single `--accent` color. Instead, each entity type (NPC, faction, location, item, story arc) has its own hue. `--accent` aliases `--ent-npc` (#60b8ff) for primary actions.
- **New fonts:** Crimson Pro (display), DM Sans (body), JetBrains Mono (mono). Replaces Georgia + Inter.
- **Rail nav replaces sidebar:** 56px icon-only rail (`Rail.tsx`) replaces the 240px text sidebar (`Sidebar.tsx`). The old `Sidebar.tsx` is deprecated.
- **Right panel is toggleable:** 300px panel slides in/out. Not always visible. Tabs for "Context" and "Session notes."

### Legacy token aliases in index.css
During migration, `index.css` contains a "Legacy aliases" section that maps old token names (e.g., `--color-bg-primary`) to new ones (e.g., `--bg-void`). This allows existing components to keep working while they're incrementally updated. **Remove legacy aliases once all components use the new token names.** You can audit usage with:
```bash
grep -r "color-bg-primary\|color-text-primary\|color-accent\|color-border\|color-success\|color-error\|color-warning" apps/web/src/ --include="*.tsx" --include="*.ts"
```

### CSS custom properties for theming, not Tailwind utilities
All layout and component styling uses CSS custom properties (e.g., `var(--bg-void)`) applied via inline `style` objects, not Tailwind utility classes. This is intentional: the token names are the foundation that task 8.1 swaps per-campaign-theme. Tailwind is still installed and available for utility styling where tokens aren't needed, but the core design system runs through custom properties. Components use inline styles so that token references are explicit and easy to audit for theme coverage.

### Shared style presets in `components/styles.ts`
`buttonAccent`, `buttonSecondary`, `buttonGhost`, `buttonAction` are exported as `CSSProperties` objects from `apps/web/src/components/styles.ts`. New presets added: `entityLink`, `entityColors`, `entityAvatarColors`, `sourceChipBase`, `sourceChipColors`, `panelSection`, `panelSectionTitle`, `elevatedCard`, `inputField`, `inputFieldFocus`. Components spread these into their `style` prop and override as needed.

### Route naming: `/campaigns` (plural) vs `/campaign/:id` (singular)
The list route is `/campaigns` and the detail route is `/campaign/:id`. This is a deliberate choice: plural for collections, singular for a specific resource's sub-pages (`/campaign/:id/chat`, `/campaign/:id/sessions`). This mirrors how you'd say "go to campaigns" vs "this campaign's chat."

### Font loading
Crimson Pro, DM Sans, and JetBrains Mono are loaded via Google Fonts in `index.html`. The `<link>` tags use `rel="preconnect"` for faster loading. If fonts fail to load, the fallback stack is Georgia → serif for display, system-ui → sans-serif for body.

---

## Embedding Model

### Migration from OpenAI to Voyage AI, then voyage-3 → voyage-4-lite (2026-03-17)

**History:**
- The PRD originally referenced OpenAI `text-embedding-3-small` as a candidate embedding model.
- During task 2.1 (embedding pipeline), Voyage AI `voyage-3` was chosen instead: same cost ($0.02/MTok), better MTEB scores, and `input_type` query/document differentiation for improved RAG retrieval quality.
- In task 2.3.5, the model was upgraded from `voyage-3` to `voyage-4-lite` for improved quality at no cost increase.

**Why Voyage AI over OpenAI embeddings:**
- Same price as OpenAI `text-embedding-3-small` ($0.02/MTok)
- `input_type: "document"` / `input_type: "query"` parameters allow the model to produce asymmetric embeddings optimised for each role — documents are indexed differently from search queries, which improves retrieval precision
- Top-tier MTEB benchmark scores
- 200M free token tier for new accounts
- Recommended by Anthropic for use with Claude

**Why voyage-4-lite over voyage-3:**
- Same $0.02/MTok price
- Same 1024-dimension output (no schema migration required — `chunks.embedding vector(1024)` is unchanged)
- Same API shape (`model`, `input`, `input_type` — no code changes beyond the model string)
- Improved quality on MTEB benchmarks

**Current state:**
- `embedding.service.ts` and `search.service.ts` both use `EMBEDDING_MODEL = "voyage-4-lite"`
- `VOYAGE_API_KEY` is the only embedding-related env var (no OpenAI key needed)
- Vector dimension remains 1024; no migration needed
