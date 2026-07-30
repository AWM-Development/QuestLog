import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testDbUrl } from "../../packages/core/src/db/test-db-url.js";

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
		// Relative path required, not the @questlog/server alias above —
		// Vitest's globalSetup loader bypasses Vite's resolver. Cross-app
		// import is intentional. Why: Docs/IMPLEMENTATION_NOTES.md § T-027.
		globalSetup: ["../../packages/core/src/db/global-setup.ts"],
		include: ["**/*.e2e.test.ts"],
		env: {
			// Own database (questlog_test_mcp), not apps/server's
			// questlog_test_server: turbo runs every package's e2e suite
			// concurrently with no `dependsOn` between them (same as the
			// default `test` task, see Docs/IMPLEMENTATION_NOTES.md § T-018 /
			// T-026 / T-071), so sharing one physical database here would
			// reopen the identical race T-026 already fixed for the default
			// tier.
			DATABASE_URL: testDbUrl("questlog_test_mcp"),
		},
	},
});
