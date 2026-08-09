import { describe, expect, it } from "vitest";
import {
	type ExitConditionGuardDeps,
	checkBulletCitation,
	runExitConditionGuard,
} from "./exit-condition-guard.js";
import type { ChangedFile } from "./guard-utils.js";

const TICKET_PATH = "Docs/tickets/done/T-200-example.md";
const REPORT_PATH = "Docs/tickets/reports/T-200-example.md";

const TICKET_CONTENT = [
	"# T-200 — Example ticket",
	"",
	"Exit condition (machine-checkable):",
	"  - all tests green, typecheck clean, lint clean",
	"  - a synthetic case does the thing",
	"",
	"Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol",
	"",
].join("\n");

function deps(
	overrides: Partial<ExitConditionGuardDeps>,
): ExitConditionGuardDeps {
	return {
		headBranch: "feat/m-pipeline/t-200-example",
		changedFiles: () => [
			{ path: TICKET_PATH, status: "added" },
			{ path: REPORT_PATH, status: "added" },
		],
		readFile: (path) => (path === TICKET_PATH ? TICKET_CONTENT : null),
		...overrides,
	};
}

function reportWithExitConditionSection(section: string): string {
	return [
		"# T-200 — Example ticket",
		"",
		"## Test evidence",
		"",
		"PASS",
		"",
		"## Exit condition check",
		"",
		section,
		"",
		"## Reviewer verdict",
		"",
		"PASS",
		"",
	].join("\n");
}

describe("checkBulletCitation", () => {
	const changed: ChangedFile[] = [
		{ path: "packages/ci/src/example.test.ts", status: "added" },
	];
	const readFile = (path: string) =>
		path === "packages/ci/src/example.test.ts"
			? 'it("does the thing correctly", () => {});'
			: null;

	it("returns null (unverifiable, not failing) for a bullet naming no file", () => {
		expect(
			checkBulletCitation(
				"the sync function behaves correctly in practice",
				changed,
				readFile,
			),
		).toBeNull();
	});

	it("returns null when the cited file and quoted test name both exist", () => {
		expect(
			checkBulletCitation(
				'see `example.test.ts` "does the thing correctly"',
				changed,
				readFile,
			),
		).toBeNull();
	});

	it("flags a bullet citing a file not present in the diff", () => {
		const issue = checkBulletCitation(
			'see `missing.test.ts:12` "some test"',
			changed,
			readFile,
		);
		expect(issue).toMatch(/missing\.test\.ts/);
		expect(issue).toMatch(/diff/);
	});

	it("flags a bullet whose quoted test name doesn't appear in the cited file", () => {
		const issue = checkBulletCitation(
			'see `example.test.ts` "a test name that was never written"',
			changed,
			readFile,
		);
		expect(issue).toMatch(/a test name that was never written/);
	});
});

describe("runExitConditionGuard", () => {
	it("passes trivially for a non-ticket-implementation PR (branch not feat/*)", () => {
		const result = runExitConditionGuard(
			deps({ headBranch: "chore/m-audit/t-200-example" }),
		);
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
	});

	it("ignores a report file that wasn't newly added", () => {
		const result = runExitConditionGuard(
			deps({
				changedFiles: () => [
					{ path: TICKET_PATH, status: "added" },
					{ path: REPORT_PATH, status: "modified" },
				],
				readFile: () =>
					reportWithExitConditionSection(
						'- claims `nope.test.ts` "nonexistent"',
					),
			}),
		);
		expect(result.ok).toBe(true);
	});

	it("fails a synthetic PR whose report claims a test at a file that doesn't exist in the diff", () => {
		const result = runExitConditionGuard(
			deps({
				changedFiles: () => [
					{ path: TICKET_PATH, status: "added" },
					{ path: REPORT_PATH, status: "added" },
				],
				readFile: (path) => {
					if (path === TICKET_PATH) return TICKET_CONTENT;
					if (path === REPORT_PATH) {
						return reportWithExitConditionSection(
							'- **the thing works** — see `packages/ci/src/nope.test.ts:84` "a real test" — proven.',
						);
					}
					return null;
				},
			}),
		);
		expect(result.ok).toBe(false);
		expect(
			result.failures.some((f) => f.message.includes("nope.test.ts")),
		).toBe(true);
	});

	it("passes a synthetic PR whose report correctly cites a real test file/name present in the diff", () => {
		const result = runExitConditionGuard(
			deps({
				changedFiles: () => [
					{ path: TICKET_PATH, status: "added" },
					{ path: REPORT_PATH, status: "added" },
					{ path: "packages/ci/src/example.test.ts", status: "added" },
				],
				readFile: (path) => {
					if (path === TICKET_PATH) return TICKET_CONTENT;
					if (path === REPORT_PATH) {
						return reportWithExitConditionSection(
							'- **the thing works** — `example.test.ts` "does the thing correctly", asserting the result.',
						);
					}
					if (path === "packages/ci/src/example.test.ts") {
						return 'it("does the thing correctly", () => {});';
					}
					return null;
				},
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
	});

	it("passes with an unverifiable-mechanically annotation for a purely behavioral bullet, not a failure", () => {
		const result = runExitConditionGuard(
			deps({
				changedFiles: () => [
					{ path: TICKET_PATH, status: "added" },
					{ path: REPORT_PATH, status: "added" },
				],
				readFile: (path) => {
					if (path === TICKET_PATH) return TICKET_CONTENT;
					if (path === REPORT_PATH) {
						return reportWithExitConditionSection(
							"- **the sync behaves correctly** — verified by manual review, no automated citation.",
						);
					}
					return null;
				},
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
		expect(result.unverifiable.length).toBe(1);
	});

	it("warns (does not fail) when the report's bullet count is short of the ticket's own Exit condition list", () => {
		const result = runExitConditionGuard(
			deps({
				changedFiles: () => [
					{ path: TICKET_PATH, status: "added" },
					{ path: REPORT_PATH, status: "added" },
				],
				readFile: (path) => {
					if (path === TICKET_PATH) return TICKET_CONTENT;
					if (path === REPORT_PATH) {
						return reportWithExitConditionSection(
							"- **only one bullet, ticket names two** — behavioral, no citation.",
						);
					}
					return null;
				},
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.warnings.length).toBe(1);
	});

	it("ignores files outside Docs/tickets/reports/", () => {
		const result = runExitConditionGuard(
			deps({
				changedFiles: () => [
					{ path: "Docs/tickets/blocked/T-200-example.md", status: "added" },
				],
				readFile: () => "anything",
			}),
		);
		expect(result.ok).toBe(true);
	});
});
