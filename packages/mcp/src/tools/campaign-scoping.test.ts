import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Matches a call to any method whose name ends in `Unscoped`. */
const UNSCOPED_CALL_PATTERN = /\.\w*Unscoped\s*\(/;

const TOOLS_DIR = dirname(fileURLToPath(import.meta.url));

const SKIP_FILES = new Set(["errors.ts", "types.ts"]);

function toolSourceFiles(): string[] {
	return readdirSync(TOOLS_DIR).filter(
		(name) =>
			name.endsWith(".ts") &&
			!name.endsWith(".test.ts") &&
			!SKIP_FILES.has(name),
	);
}

describe("campaign-scoped MCP tool lookups (T-068)", () => {
	it("matcher catches a literal Unscoped call (guard is not theater)", () => {
		const fixture = "sourceService.getByIdUnscoped(db, sourceId)";
		expect(UNSCOPED_CALL_PATTERN.test(fixture)).toBe(true);
	});

	it("matcher does not flag scoped lookups", () => {
		expect(
			UNSCOPED_CALL_PATTERN.test(
				"sourceService.getByIdForCampaign(db, campaignId, sourceId)",
			),
		).toBe(false);
	});

	it("no packages/mcp/src/tools/*.ts file calls an Unscoped method", () => {
		const violations: string[] = [];
		for (const name of toolSourceFiles()) {
			const source = readFileSync(join(TOOLS_DIR, name), "utf8");
			if (UNSCOPED_CALL_PATTERN.test(source)) {
				violations.push(name);
			}
		}
		expect(violations).toEqual([]);
	});
});
