import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

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
			DATABASE_URL:
				"postgresql://questlog:questlog@localhost:5433/questlog_test",
		},
	},
});
