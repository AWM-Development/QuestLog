import { configDefaults, defineConfig } from "vitest/config";
import { testDbUrl } from "../../packages/core/src/db/test-db-url.js";

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
		// intentional; also ordered ahead of this task by turbo.json's
		// "test": { "dependsOn": ["^test"] } (added by T-042), so packages/core's
		// own test run truncates+leaves the tables in the state this run
		// expects. Why: Docs/IMPLEMENTATION_NOTES.md § T-027 / T-042.
		globalSetup: ["../../packages/core/src/db/global-setup.ts"],
		exclude: [...configDefaults.exclude, "**/*.e2e.test.ts"],
		env: {
			DATABASE_URL: testDbUrl("questlog_test"),
		},
	},
});
