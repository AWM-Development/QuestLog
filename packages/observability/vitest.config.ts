import { defineConfig } from "vitest/config";
import {
	loadRepoRootDotenvForVitestConfig,
	testDbUrl,
} from "../core/src/db/test-db-url.js";

// Must run before testDbUrl() below resolves QUESTLOG_PG_PORT — see the
// function's own doc comment (T-152 follow-up).
loadRepoRootDotenvForVitestConfig();

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
		// T-108 added a second DB-touching, truncating test file
		// (db/migrate.test.ts) alongside ingest-db.test.ts — sequence.concurrent
		// only serializes tests within one file, so two files each truncating
		// ticket_runs could otherwise race across Vitest's default parallel
		// file workers.
		fileParallelism: false,
		// Relative path required, not a @questlog/core-style alias — Vitest's
		// globalSetup loader bypasses Vite's resolver (same reason as
		// packages/mcp/vitest.config.ts). Why: Docs/IMPLEMENTATION_NOTES.md § T-027.
		globalSetup: ["./src/db/global-setup.ts"],
		env: {
			OBSERVABILITY_DATABASE_URL: testDbUrl("questlog_test_observability"),
		},
	},
});
