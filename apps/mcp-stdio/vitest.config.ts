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
		// T-028 relocated apps/mcp's only default-tier suite (server.test.ts)
		// into apps/server, then T-042 relocated it again into packages/mcp —
		// apps/mcp-stdio is a thin stdio wrapper covered by its e2e tier and
		// scripts/smoke.ts, so the default tier legitimately has zero test
		// files. No @questlog/server alias needed here (unlike the e2e config):
		// nothing in this tier imports it.
		passWithNoTests: true,
		// Relative path required, not an alias — Vitest's globalSetup loader
		// bypasses Vite's resolver. Cross-package import is intentional. Why:
		// Docs/IMPLEMENTATION_NOTES.md § T-027.
		globalSetup: ["../../packages/core/src/db/global-setup.ts"],
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
