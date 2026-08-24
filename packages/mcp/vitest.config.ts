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
		// T-103: before this ticket, every test in this package lived in one
		// file, so Vitest's default file-level parallelism never mattered —
		// sequence.concurrent:false above was already enough to serialize
		// everything. Splitting into packages/mcp/src/tools/*.test.ts exposed
		// that all these files share the one physical questlog_test_mcp DB
		// (see comment above) with no per-file schema/namespace isolation —
		// running files in parallel (Vitest's default) causes one file's
		// beforeEach-created rows to leak into another file's "table is
		// empty" assertions (observed directly: list-campaigns.test.ts and
		// create-campaign.test.ts flaked under default parallelism with
		// leftover rows from concurrently-running files). fileParallelism:
		// false restores the pre-split, fully-serial behavior. This is a
		// necessary, not cosmetic, consequence of the split — flagged rather
		// than silently added; see Docs/IMPLEMENTATION_NOTES.md § T-103.
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
