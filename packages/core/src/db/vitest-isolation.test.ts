import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const vitestConfig = readFileSync(
	resolve(here, "../../vitest.config.ts"),
	"utf8",
);
const turboJson = JSON.parse(
	readFileSync(resolve(here, "../../../../turbo.json"), "utf8"),
) as {
	tasks: Record<string, { passThroughEnv?: string[] }>;
};

describe("T-099 vitest truncate-lock isolation", () => {
	it("defines a multi-project split so global-setup.test.ts can run without overlapping other core file workers", () => {
		expect(vitestConfig).toMatch(/projects\s*:/);
		expect(vitestConfig).toMatch(/global-setup\.test\.ts/);
		expect(vitestConfig).toMatch(/fileParallelism:\s*false/);
		// Without distinct groupOrder, Vitest runs projects in parallel and the
		// exclusive truncate locks still collide with the main pool (G-019).
		expect(vitestConfig).toMatch(/groupOrder/);
	});
});

describe("T-099 QUESTLOG_PG_PORT under turbo", () => {
	it("passes QUESTLOG_PG_PORT through the test task so worktree ports reach Vitest", () => {
		expect(turboJson.tasks.test.passThroughEnv).toContain("QUESTLOG_PG_PORT");
	});

	it("passes QUESTLOG_PG_PORT through test:e2e (also resolves DB URLs via testDbUrl)", () => {
		expect(turboJson.tasks["test:e2e"].passThroughEnv).toContain(
			"QUESTLOG_PG_PORT",
		);
	});
});
