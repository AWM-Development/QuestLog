import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";
import { testDbUrl } from "../server/src/db/test-db-url.js";

/**
 * Default test tier: unit + integration (real DB, mocked external APIs).
 * `*.e2e.test.ts` (real DB + real Voyage API) is excluded here — it has its
 * own config (vitest.e2e.config.ts) and its own script (`test:e2e`), run on
 * a schedule rather than every PR. See Docs/IMPLEMENTATION_NOTES.md.
 */
export default defineConfig({
	resolve: {
		alias: [
			{
				find: /^@questlog\/server\/(.*)$/,
				replacement: fileURLToPath(
					new URL("../server/src/$1", import.meta.url),
				),
			},
		],
	},
	test: {
		globals: true,
		sequence: { concurrent: false },
		// Relative path is required, not a leftover inconsistency with the
		// `@questlog/server` alias used below: Vitest's global-setup loader
		// bypasses Vite's resolver entirely, so swapping this for the alias
		// throws ERR_MODULE_NOT_FOUND (confirmed empirically, 2026-07-20).
		// Reaching into apps/server here is intentional, not a boundary
		// violation — apps/mcp already imports apps/server's services
		// directly everywhere else (.claude/rules/mcp.md's "sibling app, not
		// a rewrite" design) via the same first-class path alias; moving
		// global-setup.ts to packages/shared would move the coupling to
		// apps/server's schema, not remove it, since packages/shared is
		// types/constants/validators only (CLAUDE.md).
		globalSetup: ["../server/src/db/global-setup.ts"],
		// ".typecheck-out" isn't excluded by configDefaults (only "dist" is) —
		// without this, vitest's default include pattern (which matches .js as
		// well as .ts) picks up tsc -b's compiled test output there too, and
		// every test in src/ runs a second time against the compiled copy.
		exclude: [
			...configDefaults.exclude,
			"**/*.e2e.test.ts",
			"**/.typecheck-out/**",
		],
		env: {
			// Isolated from apps/server's questlog_test: turbo runs both suites
			// as separate concurrent processes against the same physical DB
			// with no ordering between them, which made an unscoped mutation
			// (e.g. a literal-empty-table assertion) unsafe here. See
			// Docs/IMPLEMENTATION_NOTES.md § T-018 / T-026.
			DATABASE_URL: testDbUrl("questlog_test_mcp"),
		},
	},
});
