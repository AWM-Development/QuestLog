import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		sequence: { concurrent: false },
		env: {
			DATABASE_URL: "postgresql://questlog:questlog@localhost:5433/questlog_test",
		},
	},
});
