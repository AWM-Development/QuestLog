import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { testDbUrl } from "@questlog/core/db/test-db-url.js";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

/**
 * T-103 split `server.test.ts`'s 22 per-tool `describe` blocks out into
 * `packages/mcp/src/tools/*.test.ts` (mirroring the production `tools/`
 * files 1:1), leaving this file as the residual home for infra-level tests
 * that aren't tool-shaped. See Docs/IMPLEMENTATION_NOTES.md § T-103.
 */
describe("global-setup DB truncation wiring (T-052)", () => {
	// Proves the fix end-to-end via a real, fresh Vitest invocation of this
	// package's own vitest.config.ts (the only way to exercise Vitest's
	// actual globalSetup timing), not just the unit-level resolution logic
	// covered by packages/core's test-db-url.test.ts and global-setup.test.ts.
	//
	// Invokes the local vitest binary directly rather than `pnpm test`:
	// pnpm/npm set recursion-guard env vars (npm_config_recursive,
	// npm_lifecycle_script, etc.) on the *current* process, and a nested
	// `pnpm --filter @questlog/mcp test` inherits them and silently no-ops
	// (exit 0, zero output) instead of actually running. Spawning the
	// vitest binary skips pnpm's script-running layer entirely, and
	// dropping the inherited npm_env_/DATABASE_URL keys below (instead of
	// just spreading process.env) makes sure the subprocess proves the
	// fix from its own vitest.config.ts wiring, not from an inherited
	// correct-by-coincidence env var.
	//
	// Guarded by an env var so the nested run skips re-spawning this same
	// test — without it, this would recurse forever.
	it.skipIf(process.env.QUESTLOG_T052_SUBPROCESS_GUARD === "1")(
		"truncates questlog_test_mcp (this package's own DB), not questlog_test, on a fresh run",
		async () => {
			const strayClient = postgres(testDbUrl("questlog_test_mcp"), {
				max: 1,
			});
			try {
				await strayClient.unsafe(
					"INSERT INTO campaigns (name, theme) VALUES ($1, $2)",
					["T-052 exit-condition stray row", "fantasy"],
				);
			} finally {
				await strayClient.end();
			}

			const mcpPackageDir = fileURLToPath(new URL("../", import.meta.url));
			const vitestBin = fileURLToPath(
				new URL("../node_modules/.bin/vitest", import.meta.url),
			);
			const subprocessEnv = Object.fromEntries(
				Object.entries(process.env).filter(
					([key]) =>
						key !== "DATABASE_URL" &&
						!key.startsWith("npm_") &&
						!key.startsWith("PNPM_") &&
						!key.startsWith("COREPACK_"),
				),
			);
			execFileSync(vitestBin, ["run"], {
				cwd: mcpPackageDir,
				env: { ...subprocessEnv, QUESTLOG_T052_SUBPROCESS_GUARD: "1" },
			});

			const checkClient = postgres(testDbUrl("questlog_test_mcp"), {
				max: 1,
			});
			try {
				const rows = await checkClient.unsafe<{ count: number }[]>(
					"SELECT count(*)::int AS count FROM campaigns WHERE name = $1",
					["T-052 exit-condition stray row"],
				);
				expect((rows[0] as { count: number }).count).toBe(0);
			} finally {
				await checkClient.end();
			}
		},
		60_000,
	);
});
