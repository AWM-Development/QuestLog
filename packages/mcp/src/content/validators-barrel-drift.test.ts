import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const CONTENT_DIR = dirname(fileURLToPath(import.meta.url));
const VALIDATORS_DIR = join(
	CONTENT_DIR,
	"..",
	"..",
	"..",
	"shared",
	"src",
	"validators",
);

/**
 * Only `export const` matters here, not `export type` — a missing type
 * re-export is a compile-time-only gap (still worth catching some day, but
 * a different failure mode); a missing `const` re-export is the one that
 * bit T-152 (see below) because it's the runtime value an MCP tool's
 * `inputSchema` actually needs.
 */
const EXPORT_CONST_PATTERN = /^export const ([A-Za-z0-9_]+)/gm;

/** Value re-exports only (`export { A, B } from "./x.js"`) — a leading
 * `type` keyword after `export` (`export type { ... } from`) is a
 * type-only re-export and never matches this pattern, by construction. */
const REEXPORT_BLOCK_PATTERN = /export\s*\{([^}]*)\}\s*from/g;

/**
 * Derives both sides straight from source text, never a hand-maintained
 * literal list — same shape as `onboarding-instructions.test.ts`'s T-140
 * guard, and for the same reason: a hardcoded list would just reintroduce
 * the drift this test exists to catch.
 */
function exportedConstNames(source: string): string[] {
	return [...source.matchAll(EXPORT_CONST_PATTERN)]
		.map((match) => match[1])
		.filter((name): name is string => Boolean(name));
}

function reExportedNames(indexSource: string): Set<string> {
	const names = new Set<string>();
	for (const block of indexSource.matchAll(REEXPORT_BLOCK_PATTERN)) {
		for (const raw of (block[1] ?? "").split(",")) {
			const name = raw.trim();
			if (name) names.add(name);
		}
	}
	return names;
}

describe("packages/shared/src/validators/index.ts barrel drift (T-152 follow-up)", () => {
	it("re-exports every export const from every validator module", () => {
		const indexSource = readFileSync(join(VALIDATORS_DIR, "index.ts"), "utf8");
		const reExported = reExportedNames(indexSource);

		const missing: string[] = [];
		for (const file of readdirSync(VALIDATORS_DIR)) {
			if (
				file === "index.ts" ||
				!file.endsWith(".ts") ||
				file.endsWith(".test.ts")
			) {
				continue;
			}
			const source = readFileSync(join(VALIDATORS_DIR, file), "utf8");
			for (const name of exportedConstNames(source)) {
				if (!reExported.has(name)) missing.push(`${name} (${file})`);
			}
		}

		// A validator module's `export const` that never reaches
		// `validators/index.ts` (a named-export barrel, not a wildcard
		// re-export — unlike `packages/shared/src/index.ts` one level up)
		// silently resolves to `undefined` at every import site outside this
		// directory: no typecheck error, no import error, just a falsy
		// runtime value. For an MCP tool's `inputSchema`, that reads as "this
		// tool takes no arguments" — every caller-supplied argument is
		// silently dropped before the handler ever sees it. Full incident
		// (T-152) and this guard's own rationale: Docs/IMPLEMENTATION_NOTES.md
		// § "`validators/index.ts` barrel-export drift guard".
		expect(missing).toEqual([]);
	});
});
