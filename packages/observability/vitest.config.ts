import { defineConfig } from "vitest/config";
import { testDbUrl } from "../core/src/db/test-db-url.js";

/**
 * Own physical database (questlog_test_observability), own globalSetup —
 * this package's schema (ticket_runs/ticket_reports) is independent of
 * packages/core's, so core's global-setup truncate list doesn't apply here.
 * See Docs/IMPLEMENTATION_NOTES.md § T-053.
 */
export default defineConfig({
	test: {
		globals: true,
		sequence: { concurrent: false },
		// Relative path required, not a @questlog/core-style alias — Vitest's
		// globalSetup loader bypasses Vite's resolver (same reason as
		// packages/mcp/vitest.config.ts). Why: Docs/IMPLEMENTATION_NOTES.md § T-027.
		globalSetup: ["./src/db/global-setup.ts"],
		env: {
			DATABASE_URL: testDbUrl("questlog_test_observability"),
		},
	},
});
