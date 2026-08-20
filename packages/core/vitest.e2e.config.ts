import { defineConfig } from "vitest/config";
import {
	loadRepoRootDotenvForVitestConfig,
	testDbUrl,
} from "./src/db/test-db-url.js";

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
		globalSetup: ["./src/db/global-setup.ts"],
		include: ["**/*.e2e.test.ts"],
		// T-042 moved this package's only e2e suite (search.e2e.test.ts) to
		// apps/server — it depends on buildApp (server.ts), which stays there,
		// and importing it back here would create a circular package reference.
		// packages/core legitimately has zero e2e test files now.
		passWithNoTests: true,
		env: {
			DATABASE_URL: testDbUrl("questlog_test_core"),
		},
	},
});
