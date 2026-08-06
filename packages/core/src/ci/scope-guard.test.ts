import { describe, expect, it } from "vitest";
import {
	type ScopeGuardDeps,
	parseContextFiles,
	runScopeGuard,
} from "./scope-guard.js";

function deps(overrides: Partial<ScopeGuardDeps>): ScopeGuardDeps {
	return {
		headBranch: "feat/m-pipeline/t-200-example",
		baseBranchName: "develop",
		changedFiles: () => [],
		readFile: () => null,
		...overrides,
	};
}

describe("parseContextFiles", () => {
	it("extracts each path from a Context files: block", () => {
		const content = [
			"Context files (load ONLY these):",
			"  - .github/workflows/ci.yml (mockup-guard job — same shape)",
			'  - Docs/tickets/TICKET_SPEC.md § "Context files" field notes',
			"",
			"Mockup: none",
		].join("\n");
		expect(parseContextFiles(content)).toEqual([
			".github/workflows/ci.yml",
			"Docs/tickets/TICKET_SPEC.md",
		]);
	});

	it("returns an empty array when there is no Context files: block", () => {
		expect(parseContextFiles("Priority: P1\n\nBranch: feat/x\n")).toEqual([]);
	});

	it("stops at the first blank line after the block", () => {
		const content = [
			"Context files (load ONLY these):",
			"  - packages/core/src/ci/gate-guard.ts",
			"",
			"Mockup: none",
			"  - Docs/tickets/TICKET_SPEC.md",
		].join("\n");
		expect(parseContextFiles(content)).toEqual([
			"packages/core/src/ci/gate-guard.ts",
		]);
	});
});

describe("runScopeGuard", () => {
	it("passes trivially for a non-ticket-implementation PR (branch not feat/*)", () => {
		const result = runScopeGuard(
			deps({
				headBranch: "chore/m-audit/t-200-example",
				changedFiles: () => [
					{ path: "Docs/mockups/foo.png", status: "modified" },
				],
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
		expect(result.warnings).toEqual([]);
	});

	it("hard-fails when the PR's base branch isn't develop", () => {
		const result = runScopeGuard(
			deps({
				baseBranchName: "main",
				changedFiles: () => [
					{
						path: "Docs/tickets/done/T-200-example.md",
						status: "added",
					},
				],
				readFile: (path) =>
					path === "Docs/tickets/done/T-200-example.md"
						? "Context files (load ONLY these):\n  - foo.ts\n"
						: null,
			}),
		);
		expect(result.ok).toBe(false);
		expect(result.failures.some((f) => /base branch/.test(f))).toBe(true);
	});

	it("hard-fails when the diff touches Docs/mockups/", () => {
		const result = runScopeGuard(
			deps({
				changedFiles: () => [
					{
						path: "Docs/tickets/done/T-200-example.md",
						status: "added",
					},
					{ path: "Docs/mockups/foo/bar.png", status: "modified" },
				],
				readFile: (path) =>
					path === "Docs/tickets/done/T-200-example.md"
						? "Context files (load ONLY these):\n  - foo.ts\n"
						: null,
			}),
		);
		expect(result.ok).toBe(false);
		expect(result.failures.some((f) => /Docs\/mockups\//.test(f))).toBe(true);
	});

	it("warns on a changed file outside both the declared Context files: set and the diff's own new files", () => {
		const result = runScopeGuard(
			deps({
				changedFiles: () => [
					{
						path: "Docs/tickets/done/T-200-example.md",
						status: "added",
					},
					{ path: "packages/core/src/ci/gate-guard.ts", status: "modified" },
					{
						path: "apps/server/src/routers/unrelated.router.ts",
						status: "modified",
					},
				],
				readFile: (path) =>
					path === "Docs/tickets/done/T-200-example.md"
						? "Context files (load ONLY these):\n  - packages/core/src/ci/gate-guard.ts\n"
						: null,
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toMatch(
			/apps\/server\/src\/routers\/unrelated\.router\.ts/,
		);
	});

	it("does not warn on a newly-added file even though it's outside Context files:", () => {
		const result = runScopeGuard(
			deps({
				changedFiles: () => [
					{
						path: "Docs/tickets/done/T-200-example.md",
						status: "added",
					},
					{
						path: "Docs/tickets/reports/T-200-example.md",
						status: "added",
					},
				],
				readFile: (path) =>
					path === "Docs/tickets/done/T-200-example.md"
						? "Context files (load ONLY these):\n  - foo.ts\n"
						: null,
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.warnings).toEqual([]);
	});

	it("does not warn on the standard wrap-up files (CHANGELOG.md, IMPLEMENTATION_NOTES.md, a milestone doc) even though they're modified, not added, and never declared", () => {
		const result = runScopeGuard(
			deps({
				changedFiles: () => [
					{
						path: "Docs/tickets/done/T-200-example.md",
						status: "added",
					},
					{ path: "CHANGELOG.md", status: "modified" },
					{ path: "Docs/IMPLEMENTATION_NOTES.md", status: "modified" },
					{
						path: "Docs/milestones/MILESTONES_V1_1_MCP.md",
						status: "modified",
					},
				],
				readFile: (path) =>
					path === "Docs/tickets/done/T-200-example.md"
						? "Context files (load ONLY these):\n  - foo.ts\n"
						: null,
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.warnings).toEqual([]);
	});

	it("does not warn on a changed file that is inside the declared Context files: set", () => {
		const result = runScopeGuard(
			deps({
				changedFiles: () => [
					{
						path: "Docs/tickets/done/T-200-example.md",
						status: "added",
					},
					{ path: "foo.ts", status: "modified" },
				],
				readFile: (path) =>
					path === "Docs/tickets/done/T-200-example.md"
						? "Context files (load ONLY these):\n  - foo.ts\n"
						: null,
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.warnings).toEqual([]);
	});

	it("resolves the ticket via an in-progress/ file when no done/ file is present in the diff", () => {
		const result = runScopeGuard(
			deps({
				changedFiles: () => [
					{
						path: "Docs/tickets/in-progress/T-200-example.md",
						status: "added",
					},
					{
						path: "apps/server/src/routers/unrelated.router.ts",
						status: "modified",
					},
				],
				readFile: (path) =>
					path === "Docs/tickets/in-progress/T-200-example.md"
						? "Context files (load ONLY these):\n  - foo.ts\n"
						: null,
			}),
		);
		expect(result.warnings).toHaveLength(1);
	});

	it("passes with no warnings when no ticket file is found in the diff (still a feat/* branch)", () => {
		const result = runScopeGuard(
			deps({
				changedFiles: () => [
					{
						path: "apps/server/src/routers/unrelated.router.ts",
						status: "modified",
					},
				],
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.warnings).toEqual([]);
	});
});
