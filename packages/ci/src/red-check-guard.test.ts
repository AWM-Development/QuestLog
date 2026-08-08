import { describe, expect, it } from "vitest";
import {
	type RedCheckGuardDeps,
	countAssertions,
	findTouchedTestFiles,
	isAssertionCountExempt,
	runRedCheckGuard,
} from "./red-check-guard.js";

function deps(overrides: Partial<RedCheckGuardDeps>): RedCheckGuardDeps {
	return {
		headBranch: "feat/m-pipeline/t-200-example",
		changedFiles: () => [],
		readFile: () => null,
		readBaseFile: () => null,
		runTestFileAgainstPreChangeSource: () => false,
		...overrides,
	};
}

describe("findTouchedTestFiles", () => {
	it("keeps added/modified .test.ts and .test.tsx files", () => {
		const result = findTouchedTestFiles([
			{ path: "packages/ci/src/foo.test.ts", status: "modified" },
			{ path: "apps/web/src/Bar.test.tsx", status: "added" },
			{ path: "packages/ci/src/foo.ts", status: "modified" },
			{ path: "packages/ci/src/baz.test.ts", status: "deleted" },
		]);
		expect(result.map((f) => f.path)).toEqual([
			"packages/ci/src/foo.test.ts",
			"apps/web/src/Bar.test.tsx",
		]);
	});
});

describe("countAssertions", () => {
	it("counts expect( and assert( calls", () => {
		const content = "expect(a).toBe(1);\nassert(b);\nexpect(c).toEqual(d);";
		expect(countAssertions(content)).toBe(3);
	});

	it("returns 0 for content with no assertions", () => {
		expect(countAssertions("const x = 1;")).toBe(0);
	});
});

describe("isAssertionCountExempt", () => {
	it("is never exempt for a brand-new file (no base content)", () => {
		expect(isAssertionCountExempt(null, "expect(a).toBe(1);")).toBe(false);
	});

	it("is exempt when the assertion count is unchanged", () => {
		const content = "expect(a).toBe(1);";
		expect(isAssertionCountExempt(content, content)).toBe(true);
	});

	it("is exempt when the assertion count dropped (a pure refactor)", () => {
		expect(
			isAssertionCountExempt(
				"expect(a).toBe(1);\nexpect(b).toBe(2);",
				"expect(a).toBe(1);",
			),
		).toBe(true);
	});

	it("is not exempt when the assertion count grew", () => {
		expect(
			isAssertionCountExempt(
				"expect(a).toBe(1);",
				"expect(a).toBe(1);\nexpect(b).toBe(2);",
			),
		).toBe(false);
	});
});

describe("runRedCheckGuard", () => {
	it("passes trivially for a non-ticket-implementation branch", () => {
		const result = runRedCheckGuard(
			deps({
				headBranch: "chore/docs-only",
				changedFiles: () => [
					{ path: "packages/ci/src/foo.test.ts", status: "added" },
				],
			}),
		);
		expect(result).toEqual({ ok: true, failures: [], exempted: [] });
	});

	it("passes trivially when the diff touches no test files", () => {
		const result = runRedCheckGuard(
			deps({
				changedFiles: () => [
					{ path: "packages/ci/src/foo.ts", status: "modified" },
				],
			}),
		);
		expect(result.ok).toBe(true);
	});

	it("passes a synthetic PR whose new test genuinely exercises new behavior (fails against pre-change source)", () => {
		const result = runRedCheckGuard(
			deps({
				changedFiles: () => [
					{ path: "packages/ci/src/foo.test.ts", status: "added" },
				],
				readFile: () => "expect(newBehavior()).toBe(true);",
				readBaseFile: () => null,
				runTestFileAgainstPreChangeSource: (path) =>
					path === "packages/ci/src/foo.test.ts",
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
	});

	it("fails a synthetic PR whose 'new' test passes against develop's pre-change source unmodified", () => {
		const result = runRedCheckGuard(
			deps({
				changedFiles: () => [
					{ path: "packages/ci/src/foo.test.ts", status: "added" },
				],
				readFile: () => "expect(1).toBe(1);", // doesn't actually test anything new
				readBaseFile: () => null,
				runTestFileAgainstPreChangeSource: () => false,
			}),
		);
		expect(result.ok).toBe(false);
		expect(result.failures[0]).toMatch(
			/doesn't actually exercise new behavior|written after/,
		);
	});

	it("exempts a synthetic PR that only refactors an existing test file with an unchanged/lower assertion count", () => {
		let ranAgainstPreChangeSource = false;
		const result = runRedCheckGuard(
			deps({
				changedFiles: () => [
					{ path: "packages/ci/src/foo.test.ts", status: "modified" },
				],
				readBaseFile: () => "expect(a).toBe(1);\nexpect(b).toBe(2);",
				readFile: () => "expect(a).toBe(1);", // renamed a var, dropped one assertion
				runTestFileAgainstPreChangeSource: () => {
					ranAgainstPreChangeSource = true;
					return false;
				},
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.exempted).toEqual(["packages/ci/src/foo.test.ts"]);
		expect(ranAgainstPreChangeSource).toBe(false); // exempted, never even run
	});

	it("only requires at least one of several touched test files to fail against pre-change source", () => {
		const result = runRedCheckGuard(
			deps({
				changedFiles: () => [
					{ path: "packages/ci/src/foo.test.ts", status: "added" },
					{ path: "packages/ci/src/bar.test.ts", status: "added" },
				],
				readFile: () => "expect(x).toBe(1);",
				readBaseFile: () => null,
				runTestFileAgainstPreChangeSource: (path) =>
					path === "packages/ci/src/bar.test.ts",
			}),
		);
		expect(result.ok).toBe(true);
	});
});
