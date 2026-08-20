import { defineConfig } from "vitest/config";
import {
	loadRepoRootDotenvForVitestConfig,
	testDbUrl,
} from "../../packages/core/src/db/test-db-url.js";

// Must run before testDbUrl() below resolves QUESTLOG_PG_PORT — see the
// function's own doc comment (T-152 follow-up).
loadRepoRootDotenvForVitestConfig();

/**
 * Real-external-API test tier — separate from the default `vitest.config.ts`.
 * Runs only `*.e2e.test.ts` files (real DB + real Voyage API), invoked via
 * `pnpm test:e2e`, not `pnpm test`. Not part of the default PR gate — see
 * Docs/IMPLEMENTATION_NOTES.md for why.
 */
export default defineConfig({
	test: {
		globals: true,
		sequence: { concurrent: false },
		globalSetup: ["../../packages/core/src/db/global-setup.ts"],
		include: ["**/*.e2e.test.ts"],
		env: {
			DATABASE_URL: testDbUrl("questlog_test_server"),
		},
	},
});
