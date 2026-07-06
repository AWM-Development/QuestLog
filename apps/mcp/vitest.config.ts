import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

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
		env: {
			DATABASE_URL:
				"postgresql://questlog:questlog@localhost:5433/questlog_test",
		},
	},
});
