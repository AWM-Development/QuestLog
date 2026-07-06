import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Real-external-API test tier — separate from the default `vitest.config.ts`.
 * Runs only `*.e2e.test.ts` files (real DB + real Voyage API), invoked via
 * `pnpm test:e2e`, not `pnpm test`. Not part of the default PR gate — see
 * Docs/IMPLEMENTATION_NOTES.md for why.
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
		include: ["**/*.e2e.test.ts"],
		env: {
			DATABASE_URL:
				"postgresql://questlog:questlog@localhost:5433/questlog_test",
		},
	},
});
