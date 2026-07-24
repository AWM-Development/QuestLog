import { defineConfig } from "vitest/config";
import { testDbUrl } from "../core/src/db/test-db-url.js";

/**
 * packages/mcp's only default-tier suite is server.test.ts (relocated here
 * by T-042, originally by T-028). Own physical database (questlog_test_mcp),
 * not packages/core's questlog_test: packages/mcp has no dependency edge to
 * apps/server, so turbo can run this package's tests concurrently with
 * apps/server's against a different physical DB — same isolation T-026
 * originally set up for apps/mcp. See Docs/IMPLEMENTATION_NOTES.md § T-018 /
 * T-026 / T-042.
 */
export default defineConfig({
	test: {
		globals: true,
		sequence: { concurrent: false },
		// Relative path required, not a @questlog/core alias — Vitest's
		// globalSetup loader bypasses Vite's resolver. Cross-package import is
		// intentional. Why: Docs/IMPLEMENTATION_NOTES.md § T-027.
		globalSetup: ["../core/src/db/global-setup.ts"],
		env: {
			DATABASE_URL: testDbUrl("questlog_test_mcp"),
		},
	},
});
