import { configDefaults, defineConfig } from "vitest/config";
import {
	loadRepoRootDotenvForVitestConfig,
	testDbUrl,
} from "./src/db/test-db-url.js";

// Must run before testDbUrl() below resolves QUESTLOG_PG_PORT — see the
// function's own doc comment (T-152 follow-up).
loadRepoRootDotenvForVitestConfig();

/**
 * Default test tier: unit + integration (real DB, mocked external APIs).
 * `*.e2e.test.ts` (real DB + real Voyage API) is excluded here — it has its
 * own config (vitest.e2e.config.ts) and its own script (`test:e2e`), run on
 * a schedule rather than every PR. See Docs/IMPLEMENTATION_NOTES.md.
 *
 * Two projects (T-099 / G-019): `global-setup.test.ts` holds mid-suite
 * exclusive truncate locks; it must not overlap other core file workers.
 * Distinct `sequence.groupOrder` keeps the projects from running in parallel
 * with each other (Vitest's default). Why: Docs/IMPLEMENTATION_NOTES.md § T-099.
 */
const sharedTest = {
	globals: true as const,
	globalSetup: ["./src/db/global-setup.ts"],
	env: {
		DATABASE_URL: testDbUrl("questlog_test_core"),
	},
};

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					...sharedTest,
					name: "truncate-lock",
					include: ["src/db/global-setup.test.ts"],
					exclude: [...configDefaults.exclude, "**/*.e2e.test.ts"],
					fileParallelism: false,
					maxWorkers: 1,
					sequence: { concurrent: false, groupOrder: 0 },
				},
			},
			{
				test: {
					...sharedTest,
					name: "core",
					exclude: [
						...configDefaults.exclude,
						"**/*.e2e.test.ts",
						"**/global-setup.test.ts",
					],
					sequence: { concurrent: false, groupOrder: 1 },
				},
			},
		],
	},
});
