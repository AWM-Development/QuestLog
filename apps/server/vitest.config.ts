import { configDefaults, defineConfig } from "vitest/config";
import {
	loadRepoRootDotenvForVitestConfig,
	testDbUrl,
} from "../../packages/core/src/db/test-db-url.js";

// Must run before testDbUrl() below resolves QUESTLOG_PG_PORT — see the
// function's own doc comment (T-152 follow-up).
loadRepoRootDotenvForVitestConfig();

/**
 * Default test tier: unit + integration (real DB, mocked external APIs).
 * `*.e2e.test.ts` (real DB + real Voyage API) is excluded here — it has its
 * own config (vitest.e2e.config.ts) and its own script (`test:e2e`), run on
 * a schedule rather than every PR. See Docs/IMPLEMENTATION_NOTES.md.
 */
export default defineConfig({
	test: {
		globals: true,
		sequence: { concurrent: false },
		// Relative path required, not a @questlog/core import — Vitest's
		// globalSetup loader bypasses Vite's resolver. Cross-package import is
		// intentional. No ordering with packages/core's test task needed —
		// each package has its own physical database (T-071). Why:
		// Docs/IMPLEMENTATION_NOTES.md § T-027 / G-008.
		globalSetup: ["../../packages/core/src/db/global-setup.ts"],
		exclude: [...configDefaults.exclude, "**/*.e2e.test.ts"],
		env: {
			DATABASE_URL: testDbUrl("questlog_test_server"),
		},
	},
});
