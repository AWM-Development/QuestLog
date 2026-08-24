import { defineConfig } from "vitest/config";
import { testDbUrl } from "../core/src/db/test-db-url.js";

/**
 * packages/mcp's default-tier suite (originally the single server.test.ts,
 * relocated here by T-042/T-028; split into packages/mcp/src/tools/*.test.ts
 * by T-103) all shares one physical database (questlog_test_mcp):
 * packages/mcp has no dependency edge to apps/server, so turbo can run this
 * package's tests concurrently with every other package's against its own
 * physical DB — same isolation T-026 originally set up for apps/mcp, T-071
 * for the rest. See Docs/IMPLEMENTATION_NOTES.md § T-018 / T-026 / T-042 /
 * T-071 / T-103.
 */
export default defineConfig({
	test: {
		globals: true,
		sequence: { concurrent: false },
		// T-103: splitting into packages/mcp/src/tools/*.test.ts exposed
		// cross-file DB pollution under Vitest's default file-level
		// parallelism (all files share one physical DB, no per-file
		// isolation). Necessary, not cosmetic — see Docs/IMPLEMENTATION_NOTES.md § T-103.
		fileParallelism: false,
		// Relative path required, not a @questlog/core alias — Vitest's
		// globalSetup loader bypasses Vite's resolver. Cross-package import is
		// intentional. Why: Docs/IMPLEMENTATION_NOTES.md § T-027.
		globalSetup: ["../core/src/db/global-setup.ts"],
		env: {
			DATABASE_URL: testDbUrl("questlog_test_mcp"),
		},
	},
});
