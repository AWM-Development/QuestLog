import { describe, expect, it } from "vitest";
import {
	type ReportGuardDeps,
	extractSection,
	findPlaceholder,
	hasRealisticTestEvidence,
	runReportGuard,
	validateReportStructure,
} from "./report-guard.js";

function deps(overrides: Partial<ReportGuardDeps>): ReportGuardDeps {
	return {
		headBranch: "feat/m-pipeline/t-200-example",
		changedFiles: () => [],
		readFile: () => null,
		...overrides,
	};
}

const FULLY_SHAPED_REPORT = [
	"# T-200 — Example ticket",
	"",
	"**Outcome:** shipped",
	"",
	"## What shipped",
	"",
	"Added a thing.",
	"",
	"## Test evidence",
	"",
	"```",
	"PASS  src/ci/report-guard.test.ts (12 tests)",
	"```",
	"",
	"## Exit condition check",
	"",
	"All conditions met — see report-guard.test.ts:42.",
	"",
	"## Reviewer verdict",
	"",
	"PASS",
	"",
	"## Efficiency notes",
	"",
	"0 retries.",
	"",
	"## Anything Alex must decide",
	"",
	"None.",
	"",
].join("\n");

describe("extractSection", () => {
	it("returns the text between a heading and the next ## heading", () => {
		const content = [
			"## Test evidence",
			"",
			"PASS everything",
			"",
			"## Exit condition check",
			"",
			"met",
		].join("\n");
		expect(extractSection(content, "## Test evidence")).toBe(
			"\n\nPASS everything\n\n",
		);
	});

	it("returns null when the heading isn't present", () => {
		expect(extractSection("## Something else", "## Test evidence")).toBeNull();
	});

	it("runs to end-of-file when it's the last heading", () => {
		const content = ["## Test evidence", "", "PASS"].join("\n");
		expect(extractSection(content, "## Test evidence")).toBe("\n\nPASS");
	});
});

describe("findPlaceholder", () => {
	it("finds a stray template placeholder like <Pasted actual output of...>", () => {
		expect(
			findPlaceholder("## Test evidence\n\n<Pasted actual output of tests>"),
		).toBe("<Pasted actual output of tests>");
	});

	it("returns null when there is no bracketed placeholder", () => {
		expect(findPlaceholder("## Test evidence\n\nPASS everything")).toBeNull();
	});

	it("does not flag a short generic-looking bracket like <T>", () => {
		expect(findPlaceholder("uses a generic type <T> here")).toBeNull();
	});
});

describe("hasRealisticTestEvidence", () => {
	it("accepts a section containing a PASS marker", () => {
		expect(hasRealisticTestEvidence("PASS  12 tests")).toBe(true);
	});

	it("accepts a section containing a file:line pattern", () => {
		expect(hasRealisticTestEvidence("see report-guard.test.ts:42")).toBe(true);
	});

	it("rejects bare prose with no recognizable tool-output marker", () => {
		expect(
			hasRealisticTestEvidence("all tests pass, everything is great"),
		).toBe(false);
	});
});

describe("validateReportStructure", () => {
	const headings = ["## A", "## B"];

	it("returns an issue per missing required heading", () => {
		const issues = validateReportStructure("## A\n\ncontent", headings, {
			checkTestEvidence: false,
		});
		expect(issues).toEqual(["missing required section: ## B"]);
	});

	it("returns an issue for a leftover placeholder", () => {
		const issues = validateReportStructure(
			"## A\n\n<placeholder text here>\n\n## B\n\ncontent",
			headings,
			{ checkTestEvidence: false },
		);
		expect(issues.some((i) => i.includes("<placeholder text here>"))).toBe(
			true,
		);
	});

	it("returns no issues for a fully-shaped, placeholder-free report", () => {
		const issues = validateReportStructure(
			FULLY_SHAPED_REPORT,
			[
				"## What shipped",
				"## Test evidence",
				"## Exit condition check",
				"## Reviewer verdict",
				"## Efficiency notes",
				"## Anything Alex must decide",
			],
			{ checkTestEvidence: true },
		);
		expect(issues).toEqual([]);
	});

	it("flags a Test evidence section with no realistic tool-output marker, when checkTestEvidence is true", () => {
		const content = "## Test evidence\n\nall tests pass\n\n## B\n\nok";
		const issues = validateReportStructure(
			content,
			["## Test evidence", "## B"],
			{
				checkTestEvidence: true,
			},
		);
		expect(issues.some((i) => /doesn't look like real/.test(i))).toBe(true);
	});
});

describe("runReportGuard", () => {
	it("passes trivially for a non-ticket-implementation PR (branch not feat/*)", () => {
		const result = runReportGuard(
			deps({
				headBranch: "chore/m-audit/t-200-example",
				changedFiles: () => [
					{ path: "Docs/tickets/reports/T-200-example.md", status: "added" },
				],
				readFile: () => "## incomplete",
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
	});

	it("ignores a report file that wasn't newly added (e.g. a later edit)", () => {
		const result = runReportGuard(
			deps({
				changedFiles: () => [
					{
						path: "Docs/tickets/reports/T-200-example.md",
						status: "modified",
					},
				],
				readFile: () => "## incomplete",
			}),
		);
		expect(result.ok).toBe(true);
	});

	it("fails a synthetic PR adding a report missing ## Reviewer verdict", () => {
		const missingVerdict = FULLY_SHAPED_REPORT.replace(
			/## Reviewer verdict\n\nPASS\n\n/,
			"",
		);
		const result = runReportGuard(
			deps({
				changedFiles: () => [
					{
						path: "Docs/tickets/reports/T-200-example.md",
						status: "added",
					},
				],
				readFile: (path) =>
					path === "Docs/tickets/reports/T-200-example.md"
						? missingVerdict
						: null,
			}),
		);
		expect(result.ok).toBe(false);
		expect(result.failures.some((f) => f.includes("## Reviewer verdict"))).toBe(
			true,
		);
	});

	it("fails a synthetic PR adding a report with a leftover <Pasted actual output...> placeholder", () => {
		const withPlaceholder = FULLY_SHAPED_REPORT.replace(
			"PASS  src/ci/report-guard.test.ts (12 tests)",
			"<Pasted actual output of pnpm test>",
		);
		const result = runReportGuard(
			deps({
				changedFiles: () => [
					{
						path: "Docs/tickets/reports/T-200-example.md",
						status: "added",
					},
				],
				readFile: (path) =>
					path === "Docs/tickets/reports/T-200-example.md"
						? withPlaceholder
						: null,
			}),
		);
		expect(result.ok).toBe(false);
		expect(
			result.failures.some((f) => f.includes("<Pasted actual output")),
		).toBe(true);
	});

	it("passes a synthetic PR adding a fully-shaped report", () => {
		const result = runReportGuard(
			deps({
				changedFiles: () => [
					{
						path: "Docs/tickets/reports/T-200-example.md",
						status: "added",
					},
				],
				readFile: (path) =>
					path === "Docs/tickets/reports/T-200-example.md"
						? FULLY_SHAPED_REPORT
						: null,
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
	});

	it("ignores files outside Docs/tickets/reports/", () => {
		const result = runReportGuard(
			deps({
				changedFiles: () => [
					{ path: "Docs/tickets/blocked/T-200-example.md", status: "added" },
				],
				readFile: () => "## incomplete",
			}),
		);
		expect(result.ok).toBe(true);
	});
});
