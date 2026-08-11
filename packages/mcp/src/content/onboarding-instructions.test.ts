import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ONBOARDING_INSTRUCTIONS } from "./onboarding-instructions.js";

const CONTENT_DIR = dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = join(CONTENT_DIR, "..", "tools");

/** Matches `server.registerTool(\n\t"tool_name",` — same shape every register*.ts file uses. */
const REGISTER_TOOL_NAME_PATTERN = /registerTool\(\s*"([a-z_]+)"/g;

/**
 * `help` is exempt (ticket's own Out of scope note: it "uses the same
 * constant, already covered by this same string") — without this, the
 * assertion below would only pass by coincidence, via "help" matching as a
 * substring of the prose's opening "QuestLog helps you manage...", not by
 * any deliberate documentation of the `help` tool itself.
 */
const EXEMPT_TOOL_NAMES = new Set(["help"]);

/**
 * Derives the live registered-tool-name list straight from each `tools/*.ts`
 * source file's own `server.registerTool("<name>", ...)` call — never a
 * hardcoded literal list, which would just reintroduce the drift this test
 * exists to catch (T-140).
 */
function registeredToolNames(): string[] {
	const names: string[] = [];
	for (const file of readdirSync(TOOLS_DIR)) {
		if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
		const source = readFileSync(join(TOOLS_DIR, file), "utf8");
		for (const match of source.matchAll(REGISTER_TOOL_NAME_PATTERN)) {
			const name = match[1];
			if (name && !EXEMPT_TOOL_NAMES.has(name)) names.push(name);
		}
	}
	return names;
}

describe("ONBOARDING_INSTRUCTIONS drift (T-140)", () => {
	it("mentions every currently-registered tool name", () => {
		const missing = registeredToolNames().filter(
			(name) => !ONBOARDING_INSTRUCTIONS.includes(name),
		);
		expect(missing).toEqual([]);
	});
});
