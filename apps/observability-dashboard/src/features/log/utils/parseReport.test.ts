import { describe, expect, it } from "vitest";
import { parseReport } from "./parseReport.js";

const SHIPPED_CONTENT = `# T-044 — Consolidate MILESTONES_PT1/PT2 v2 detail

**Outcome:** shipped
**Branch:** feat/pipeline/t-044-consolidate-milestones
**Diff:** 4 files changed, +210/-180 lines
**Complexity tier:** M
**Strategy-gate flag:** no

## What shipped

Extracted every deferred-to-v2 milestone task from PT1/PT2 into a new
MILESTONES_V2.md, matching V1_MCP's structure; retired both PT files.

## Test evidence

\`\`\`
lint: pass
typecheck: pass
test: pass (312 passed)
\`\`\`

## Exit condition check

✓ all milestone-doc checkboxes migrated
✓ PT1/PT2 removed

## Reviewer verdict

**PASS**

> Clean 1:1 migration, no scope drift, checkbox state preserved.

## Efficiency notes

Straightforward extraction — the PT files were already well-organized.

**Retry log:** 1 retry: 1 mechanical_lint_typecheck (missing trailing newline).

## Anything Alex must decide

Nothing — shipped clean.
`;

const BLOCKED_CONTENT = `# T-039 — Scalability-into-v2 architecture review — BLOCKED

## What failed

Could not settle on a single scalability comparison table without Alex's
own product judgment.

## Approaches attempted

### 1. Drafted a three-way comparison table
Stalled — every axis needed a judgment call, not a rubric.

### 2. Tried narrowing to a single recommended architecture
Same problem, one level down.

### 3. Tried deferring the comparison and just listing tradeoffs
Still needed Alex's prioritization to be useful.

## Hypothesis

This ticket requires ongoing product judgment throughout, not a single
yes/no call at the start.

## Exact question for Alex

Should this ticket be re-run as an interactive session, or is there a
narrower machine-checkable slice worth extracting first?

## Efficiency notes

Burned the full iteration cap because each approach only revealed the
judgment-call problem after significant drafting.

**Retry log:** 3 retries: 3 genuine_bug_caught_by_test.

## Branch state

- Branch: feat/pipeline/t-039-scalability-review
- Last commit: abc123 chore: draft comparison table
- Uncommitted changes: no
- Tests: n/a
`;

describe("parseReport", () => {
	it("extracts a shipped report's title, tier, summary, and shipped-shape sections", () => {
		const parsed = parseReport("shipped", SHIPPED_CONTENT);

		expect(parsed.kind).toBe("shipped");
		expect(parsed.title).toBe("Consolidate MILESTONES_PT1/PT2 v2 detail");
		expect(parsed.complexityTier).toBe("m");
		expect(parsed.summary).toMatch(/Extracted every deferred-to-v2/);
		expect(parsed.exactQuestion).toBeNull();

		const labels = parsed.sections.map((s) => s.label);
		expect(labels).toEqual([
			"Test evidence",
			"Exit conditions",
			"Reviewer verdict",
			"Efficiency notes",
			"Alex must decide",
		]);
		expect(
			parsed.sections.find((s) => s.label === "Test evidence")?.value,
		).toMatch(/test: pass \(312 passed\)/);
		expect(
			parsed.sections.find((s) => s.label === "Reviewer verdict")?.value,
		).toMatch(/\*\*PASS\*\*/);
		expect(
			parsed.sections.find((s) => s.label === "Efficiency notes")?.value,
		).toMatch(/Retry log.*mechanical_lint_typecheck/s);

		// The mockup's always-visible ".log-notes" aside is the Efficiency
		// notes prose alone (its self-report "why this ran the way it did"
		// sentence), with the Retry log line stripped — the full text
		// (including Retry log) stays available in `sections` above.
		expect(parsed.efficiencyNotesSummary).toBe(
			"Straightforward extraction — the PT files were already well-organized.",
		);
		expect(parsed.efficiencyNotesSummary).not.toMatch(/Retry log/);
	});

	it("extracts a blocked report's title (BLOCKED suffix stripped), exact question, and blocked-shape sections", () => {
		const parsed = parseReport("blocked", BLOCKED_CONTENT);

		expect(parsed.kind).toBe("blocked");
		expect(parsed.title).toBe("Scalability-into-v2 architecture review");
		expect(parsed.summary).toMatch(/Could not settle on a single/);
		expect(parsed.exactQuestion).toMatch(
			/Should this ticket be re-run as an interactive session/,
		);

		const labels = parsed.sections.map((s) => s.label);
		expect(labels).toEqual([
			"What was attempted",
			"Why it stopped",
			"Efficiency notes",
			"Branch state",
		]);
		expect(
			parsed.sections.find((s) => s.label === "What was attempted")?.value,
		).toMatch(/Drafted a three-way comparison table/);
		expect(parsed.efficiencyNotesSummary).toBe(
			"Burned the full iteration cap because each approach only revealed the\njudgment-call problem after significant drafting.",
		);
	});

	it("falls back to an untitled/empty shape when a section is missing rather than throwing", () => {
		const parsed = parseReport("shipped", "# T-001 — Minimal ticket\n");

		expect(parsed.title).toBe("Minimal ticket");
		expect(parsed.summary).toBe("");
		expect(parsed.complexityTier).toBeNull();
		expect(parsed.sections.every((s) => typeof s.value === "string")).toBe(
			true,
		);
		expect(parsed.efficiencyNotesSummary).toBe("");
	});
});
