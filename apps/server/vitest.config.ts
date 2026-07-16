import { configDefaults, defineConfig } from "vitest/config";

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
		globalSetup: ["./src/db/global-setup.ts"],
		exclude: [...configDefaults.exclude, "**/*.e2e.test.ts"],
		env: {
			DATABASE_URL:
				"postgresql://questlog:questlog@localhost:5433/questlog_test",
		},
	},
});
