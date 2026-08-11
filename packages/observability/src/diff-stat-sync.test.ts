import { describe, expect, it } from "vitest";
import { mapPrViewToDiffStats, ticketBranchPattern } from "./diff-stat-sync.js";

describe("ticketBranchPattern", () => {
	it("matches this repo's feat/<milestone-group>/t-###-<slug> convention for the given ticket id", () => {
		const pattern = ticketBranchPattern("T-055");
		expect(pattern.test("feat/m-obs/t-055-pr-diff-stat-sync")).toBe(true);
	});

	it("normalizes the ticket id to lowercase, matching this repo's lowercase branch-name convention", () => {
		// Branch names are conventionally lowercase in this repo, so the
		// pattern is built lowercase from the ticket id regardless of the
		// id's own casing — it does not accept an uppercase branch segment.
		expect(ticketBranchPattern("t-055").test("feat/m-obs/t-055-x")).toBe(true);
		expect(
			ticketBranchPattern("T-055").test("feat/m-obs/T-055-pr-diff-stat-sync"),
		).toBe(false);
	});

	it("does not match a different ticket id that shares a numeric prefix", () => {
		const pattern = ticketBranchPattern("T-5");
		expect(pattern.test("feat/m-obs/t-55-other-ticket")).toBe(false);
	});

	it("does not match a branch with no milestone-group segment", () => {
		const pattern = ticketBranchPattern("T-055");
		expect(pattern.test("feat/t-055-pr-diff-stat-sync")).toBe(false);
	});

	it("does not match a completely unrelated branch", () => {
		const pattern = ticketBranchPattern("T-055");
		expect(pattern.test("chore/docs/t-999-unrelated")).toBe(false);
	});
});

describe("mapPrViewToDiffStats", () => {
	it("maps a gh pr view JSON response's additions/deletions/changedFiles to the three diff-stat fields", () => {
		expect(
			mapPrViewToDiffStats({
				additions: 42,
				deletions: 7,
				changedFiles: 5,
			}),
		).toEqual({
			filesChanged: 5,
			linesAdded: 42,
			linesRemoved: 7,
		});
	});

	it("maps a zero-diff PR (e.g. a docs-only rename) without dropping any field", () => {
		expect(
			mapPrViewToDiffStats({ additions: 0, deletions: 0, changedFiles: 0 }),
		).toEqual({ filesChanged: 0, linesAdded: 0, linesRemoved: 0 });
	});
});
