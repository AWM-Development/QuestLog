---
paths:
  - "**/db/**"
  - "**/*.sql"
---

<!-- Mirrored to .cursor/rules/db.mdc — edit here first, then copy the body (not frontmatter) over. Do not edit the .mdc directly. -->

# Database conventions

## Migration workflow — journal only, never `drizzle-kit push`

CI applies migrations via `pnpm --filter @questlog/server db:migrate`, which only runs files listed in `packages/core/src/db/migrations/meta/_journal.json`. `drizzle-kit push` edits the live schema directly and bypasses the journal — mixing the two leaves SQL on disk that CI never applies (this has happened before: see `Docs/IMPLEMENTATION_NOTES.md §Database Migrations` for the incident).

**Rule:** every schema change (`src/db/schema/*.ts`) produces a journaled migration. If you ever run `push` against a dev DB, immediately run `drizzle-kit generate` and commit both the SQL file and the journal entry. CI's migration-guard job hard-fails a PR that changes `schema/` without a corresponding file in `migrations/`.

Extension-creation statements (`CREATE EXTENSION IF NOT EXISTS ...`) belong in the migration SQL itself, not only in `migrate.ts` at runtime — a fresh Postgres instance applying migrations in CI needs the extension before any statement that uses it.

## pgvector conventions

- `chunks.embedding` is `vector(1024)` — matches the current Voyage embedding model (`voyage-4-lite`, see `.claude/rules/mcp.md` / `IMPLEMENTATION_NOTES.md §Embedding`). pgvector cannot resize a vector column in place; a dimension change requires a migration that drops and recreates the column.
- Cosine similarity search uses the `<=>` operator; `score = 1 - distance`. See `search.service.ts` for the canonical query shape (campaign-filtered, ordered, limited).
- `input_type` matters when calling Voyage: `"document"` for source chunks, `"query"` for search queries. Omitting it degrades retrieval quality.

## pg_trgm conventions

Used for fuzzy entity matching (`word_similarity` for a low-threshold candidate pre-filter, `similarity` for per-token confirmation — both phases are required, using only one over- or under-matches) and as the keyword leg of hybrid search in context assembly. GIN trigram indexes exist on columns queried this way (e.g. `entities_name_trgm_idx`) — add one for any new trigram-queried column.

## Test database

Each DB-touching package has its own physical test database on `:5433` (docker-compose) — `questlog_test_core` (`packages/core`), `questlog_test_server` (`apps/server`), `questlog_test_mcp` (`packages/mcp`/`apps/mcp-stdio`); canonical list in `scripts/test-db-names.sh` (T-071). `global-setup.ts` truncates tables between test files but does **not** run migrations — run `db:migrate` against each one manually after pulling a new migration, or tests fail with missing-column errors.
