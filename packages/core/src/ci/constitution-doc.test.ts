import { describe, expect, it } from "vitest";
import {
	type ConstitutionDocDeps,
	checkConstitutionDoc,
} from "./constitution-doc.js";

function deps(overrides: Partial<ConstitutionDocDeps>): ConstitutionDocDeps {
	return {
		readFile: () => null,
		...overrides,
	};
}

describe("checkConstitutionDoc", () => {
	it("fails when AGENTS.md doesn't exist", () => {
		const result = checkConstitutionDoc(
			deps({
				readFile: (path) =>
					path === "CLAUDE.md" ? "# CLAUDE.md\n\nSee AGENTS.md.\n" : null,
			}),
		);
		expect(result.ok).toBe(false);
		expect(result.failures).toContainEqual(
			expect.objectContaining({ path: "AGENTS.md" }),
		);
	});

	it("fails when AGENTS.md is missing a required section", () => {
		const result = checkConstitutionDoc(
			deps({
				readFile: (path) => {
					if (path === "AGENTS.md") {
						return "## Principles\n## Commands\n## Pointer map\n";
					}
					if (path === "CLAUDE.md") return "See AGENTS.md.\n";
					return null;
				},
			}),
		);
		expect(result.ok).toBe(false);
		expect(result.failures).toContainEqual(
			expect.objectContaining({
				path: "AGENTS.md",
				message: expect.stringContaining("Hard rules"),
			}),
		);
	});

	it("fails when AGENTS.md has every section but no task-source line", () => {
		const result = checkConstitutionDoc(
			deps({
				readFile: (path) => {
					if (path === "AGENTS.md") {
						return "## Principles\n## Commands\n## Pointer map\n## Hard rules\n";
					}
					if (path === "CLAUDE.md") return "See AGENTS.md.\n";
					return null;
				},
			}),
		);
		expect(result.ok).toBe(false);
		expect(result.failures).toContainEqual(
			expect.objectContaining({
				path: "AGENTS.md",
				message: expect.stringContaining("task-source"),
			}),
		);
	});

	it("fails when CLAUDE.md is over 10 lines", () => {
		const longClaude = `${Array(12).fill("line").join("\n")}\nAGENTS.md\n`;
		const result = checkConstitutionDoc(
			deps({
				readFile: (path) => {
					if (path === "AGENTS.md") {
						return "## Principles\n## Commands\n## Pointer map\n## Hard rules\nDocs/milestones/MILESTONES_V1_MCP.md\n";
					}
					if (path === "CLAUDE.md") return longClaude;
					return null;
				},
			}),
		);
		expect(result.ok).toBe(false);
		expect(result.failures).toContainEqual(
			expect.objectContaining({
				path: "CLAUDE.md",
				message: expect.stringContaining("lines"),
			}),
		);
	});

	it("fails when CLAUDE.md doesn't mention AGENTS.md", () => {
		const result = checkConstitutionDoc(
			deps({
				readFile: (path) => {
					if (path === "AGENTS.md") {
						return "## Principles\n## Commands\n## Pointer map\n## Hard rules\nDocs/milestones/MILESTONES_V1_MCP.md\n";
					}
					if (path === "CLAUDE.md")
						return "# CLAUDE.md\n\nQuestLog is a thing.\n";
					return null;
				},
			}),
		);
		expect(result.ok).toBe(false);
		expect(result.failures).toContainEqual(
			expect.objectContaining({ path: "CLAUDE.md" }),
		);
	});

	it("passes when AGENTS.md carries the full constitution and CLAUDE.md is a short pointer", () => {
		const result = checkConstitutionDoc(
			deps({
				readFile: (path) => {
					if (path === "AGENTS.md") {
						return "## Principles\n## Commands\n## Pointer map\n## Hard rules\nDocs/milestones/MILESTONES_V1_MCP.md\n";
					}
					if (path === "CLAUDE.md") {
						return "# CLAUDE.md — QuestLog\n\nSee AGENTS.md for the full constitution.\n";
					}
					return null;
				},
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
	});
});
