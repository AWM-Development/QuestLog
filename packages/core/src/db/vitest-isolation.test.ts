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

		const truncateLockBlock = vitestConfig.match(
			/name:\s*"truncate-lock"[\s\S]*?(?=name:\s*"core"|$)/,
		)?.[0];
		expect(truncateLockBlock).toBeDefined();
		expect(truncateLockBlock).toMatch(/fileParallelism:\s*false/);
		expect(truncateLockBlock).toMatch(/groupOrder:\s*0\b/);

		// Without distinct groupOrder, Vitest runs projects in parallel and the
		// exclusive truncate locks still collide with the main pool (G-019).
		expect(vitestConfig).toMatch(/name:\s*"core"[\s\S]*?groupOrder:\s*1\b/);
		expect(vitestConfig).not.toMatch(/name:\s*"core"[\s\S]*?groupOrder:\s*0\b/);
	});
});

describe("T-099 QUESTLOG_PG_PORT under turbo", () => {
	it("passes QUESTLOG_PG_PORT through the test task so worktree ports reach Vitest", () => {
		const passThrough = turboJson.tasks.test?.passThroughEnv;
		expect(passThrough).toBeDefined();
		expect(passThrough).toContain("QUESTLOG_PG_PORT");
	});

	it("passes QUESTLOG_PG_PORT through test:e2e (also resolves DB URLs via testDbUrl)", () => {
		const passThrough = turboJson.tasks["test:e2e"]?.passThroughEnv;
		expect(passThrough).toBeDefined();
		expect(passThrough).toContain("QUESTLOG_PG_PORT");
	});
});
