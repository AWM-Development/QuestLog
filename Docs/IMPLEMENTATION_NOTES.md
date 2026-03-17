# QuestLog — Implementation Notes

**Location:** `Docs/IMPLEMENTATION_NOTES.md`

**Purpose:** A running log of non-obvious implementation decisions, gotchas, and things future AI agents (and future-you) need to know before touching the codebase. This is for information that *isn't* derivable from reading the code and *isn't* in the PRD.

Read this at the start of every coding session. Add to it when you make a non-obvious decision.

**Related Docs:**
- `Docs/DEVELOPMENT_GUIDE.md` — Coding conventions and patterns
- `Docs/PRD.md` — Product specification
- `Docs/DESIGN_SYSTEM.md` — Visual design spec (color tokens, components, entity system)

**Last Updated:** 2026-03-17 (code review cleanup — Voyage client consolidation, config extraction, dead code removal)

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
- **Rail nav replaces sidebar:** 56px icon-only rail (`Rail.tsx`) replaces the 240px text sidebar. The old `Sidebar.tsx` has been deleted.
- **Right panel is toggleable:** 300px panel slides in/out. Not always visible. Tabs for "Context" and "Session notes."

### Legacy token aliases — removed
The old brown/amber CSS token aliases (`--color-bg-primary`, `--color-accent`, etc.) have been fully removed from `index.css`. The deprecated `Sidebar.tsx` was the last consumer of those tokens; it has been deleted. All active components now use the new design system tokens directly.

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
- `voyage.client.ts` is the shared HTTP client — it owns the API URL, model name (`voyage-4-lite`), auth header, `EmbeddingResponse` type, and batch size constant. Both `embedding.service.ts` and `search.service.ts` call `callVoyageEmbeddings()` from this module.
- `VOYAGE_API_KEY` is the only embedding-related env var (no OpenAI key needed)
- Vector dimension remains 1024; no migration needed

---

## Context Assembly Service (task 3.1)

### What it does
`contextService.assemble(db, input)` builds a structured text block suitable for injection into an LLM prompt. Given a query and campaign ID it pulls from four sources and assembles them in this order:

1. **Campaign metadata** — name, description, game system, theme
2. **Relevant chunks** — top-k vector search results, re-ranked with recency blending
3. **Campaign entities** — all entities up to the entity token budget
4. **Conversation history** — recent messages from the specified conversation (optional)

### Token budget split
Default total budget is 100 000 tokens, split as:

| Section  | Ratio | Tokens (default) |
|----------|-------|-----------------|
| Chunks   | 60 %  | 60 000          |
| History  | 25 %  | 25 000          |
| Entities | 10 %  | 10 000          |
| Metadata |  5 %  | 5 000           |

The budget and `searchLimit` (default 40 candidates per search path) are configurable per-call via `ContextInput`. All magic numbers (budget ratios, recency weight, keyword threshold, dual-match boost, search limit) are centralised in the exported `CONTEXT_CONFIG` object for easy tuning and test assertions. Token counting uses a fast approximation: `ceil(words / 0.75)` — fast enough for budget math, no tiktoken dependency.

### Recency weighting
After vector search, chunks are re-ranked with:
```
combinedScore = 0.9 * cosineSimilarity + 0.1 * recencyScore
```
`recencyScore` is normalised to [0, 1] within the result set (newest = 1.0, oldest = 0.0). When all chunks share the same timestamp, recency has no effect. This ensures newer lore beats equally-relevant older lore without completely overriding semantic relevance.

Chunks are then greedily packed into the chunk budget; a chunk that doesn't fit is skipped (not breaking) so smaller later chunks can still be included.

### Confidence score
`AssembledContext.confidence` is the average cosine similarity of the included chunks (0 when no chunks). This is surfaced in the milestone 11.2 "answer confidence" UI. Callers don't need to compute it — it comes back with every `assemble()` call.

### Conversation history truncation
History is fetched newest-first. Oldest messages are dropped when the history budget is exhausted, keeping the most recent exchange intact. After truncation, messages are reversed back to chronological order before assembly.

### Test override: `fetchFn`
`ContextInput.fetchFn` is passed through to `searchService.search`, which forwards it to the Voyage AI HTTP call. This lets unit tests inject a mock `fetch` and avoid network calls entirely — no environment variable patching needed.

### Output shape
```ts
interface AssembledContext {
  text: string;           // ready-to-inject prompt section
  citations: ContextCitation[];  // chunkId + sourceName + sourceId per chunk
  confidence: number;     // avg cosine similarity of included chunks
  tokenCount: number;     // estimated tokens of assembled text
}
```

### `createdAt` on SearchResult
`search.service.ts` now returns `createdAt: Date` on each `SearchResult`. This field comes from the `chunks` table's `createdAt` column and is required by the recency ranking logic. Tests that mock `searchService.search` need to include this field.

### Hybrid search (vector + keyword)
`contextService.assemble()` now runs vector search and pg_trgm keyword search in parallel, then merges results via `mergeSearchResults()` before recency re-ranking. Key constants:

- `KEYWORD_SEARCH_THRESHOLD = 0.1` — minimum trgm similarity to include a chunk from keyword search
- `DUAL_MATCH_BOOST = 0.1` — score boost added when a chunk appears in both result sets
- `DEFAULT_SEARCH_LIMIT = 40` — candidate chunks retrieved by each search path

`mergeSearchResults` is exported for direct unit testing. Scoring rules:
- In both result sets → vector score + 0.1 (capped at 1.0)
- Vector only → vector score unchanged
- Keyword only → trgm similarity score as-is

The keyword search uses Drizzle's `sql` template literals, so `query` is always a parameterized value — no SQL injection risk.
