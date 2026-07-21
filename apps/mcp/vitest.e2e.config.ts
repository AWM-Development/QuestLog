import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testDbUrl } from "../server/src/db/test-db-url.js";

/**
 * Real-external-API test tier — separate from the default `vitest.config.ts`.
 * Runs only `*.e2e.test.ts` files (real DB + real Voyage API), invoked via
 * `pnpm test:e2e`, not `pnpm test`. Not part of the default PR gate — see
 * Docs/IMPLEMENTATION_NOTES.md for why.
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
		include: ["**/*.e2e.test.ts"],
		env: {
			// Own database (questlog_test_mcp), not apps/server's questlog_test:
			// turbo runs both packages' e2e suites concurrently with no
			// `dependsOn` between them (same as the default `test` task, see
			// Docs/IMPLEMENTATION_NOTES.md § T-018 / T-026), so sharing one
			// physical database here would reopen the identical race T-026
			// already fixed for the default tier.
			DATABASE_URL: testDbUrl("questlog_test_mcp"),
		},
	},
});
