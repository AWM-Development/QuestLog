import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// drizzle-kit loads this file via esbuild-register, which transpiles syntax
// per-file but doesn't do tsx/vitest's .js->.ts extension remapping for
// relative imports — so the cross-package `testDbUrl` import other configs
// use (IMPLEMENTATION_NOTES.md §"Defense-in-depth runtime guard") fails to
// resolve here specifically. Inlined fallback, kept in sync with
// `packages/core/src/db/test-db-url.ts`'s `testDbUrl("questlog")` output.
const FALLBACK_DATABASE_URL =
	"postgresql://questlog:questlog@localhost:5433/questlog";

export default defineConfig({
	schema: "../../packages/core/src/db/schema/tables.ts",
	out: "../../packages/core/src/db/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL ?? FALLBACK_DATABASE_URL,
	},
});
