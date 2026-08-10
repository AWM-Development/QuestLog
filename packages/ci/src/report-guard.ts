// Layout: constants → exported types → exported logic → private CLI wiring →
// CLI entry. Only the functions imported by report-guard.test.ts are
// exported (Shape 1, .claude/rules/scripts.md).
import {
	type ChangedFile,
	gitChangedFiles,
	readRepoFile,
	resolveRepoRoot,
} from "./guard-utils.js";

const REPORT_FILE_RE = /^Docs\/tickets\/reports\/(T-\d+)-.*\.md$/;

// REPORT_TEMPLATE.md's required `## ` headings — mirrors that file's
// fenced example exactly (Docs/tickets/REPORT_TEMPLATE.md).
export const REQUIRED_REPORT_HEADINGS = [
	"## What shipped",
	"## Test evidence",
	"## Exit condition check",
	"## Reviewer verdict",
	"## Efficiency notes",
	"## Anything Alex must decide",
];

// A template placeholder is a single-line `<...>` instructional stub left
// over from copying REPORT_TEMPLATE.md/BLOCKED_TEMPLATE.md verbatim (e.g.
// "<Pasted actual output of...>"). Length-gated so it doesn't flag a short
// generic-type-looking bracket like `<T>` that could legitimately appear
// in pasted code/output.
const PLACEHOLDER_RE = /<[^<>\n]{4,}>/;

// A finished report legitimately *quotes* the placeholder shape inline —
// either in backticks (e.g. this ticket's own report: "a leftover
// `<Pasted actual output...>` placeholder") or in a plain double-quoted
// test-name string (e.g. the same report quoting a vitest `it(...)` title
// verbatim: "fails a synthetic PR adding a report with a leftover
// <Pasted actual output...> placeholder") — without either being a real
// leftover placeholder. REPORT_TEMPLATE.md's actual placeholders are bare
// prose, never inside backticks or quotes. Strip both span kinds before
// matching. Deliberately doesn't touch ``` fenced blocks — a placeholder
// pasted there instead of real output (the Test evidence section's actual
// failure mode) must still be caught.
const INLINE_CODE_SPAN_RE = /(?<!`)`(?!`)[^`\n]+`(?!`)/g;
const DOUBLE_QUOTED_SPAN_RE = /"[^"\n]+"/g;

// Heuristic for "looks like real command output," not prose describing it:
// PASS/FAIL/✓ markers, a file:line reference, or scripts/run-tests-quiet.sh's
// own line-anchored `stage: pass`/`stage: fail` summary shape (e.g.
// "lint: pass (0 warnings)", "test: pass (808 passed)") — lowercase and
// line-anchored (`^<word>: pass`) specifically so it can't be satisfied by
// loose prose like "all tests pass, everything is great", which has no
// leading `word:` before "pass". Deliberately no case-insensitive flag: that
// would let `\bPASS\b`/`\bFAIL\b` match the same loose prose case-insensitively,
// which is exactly what the line-anchored alternative exists to avoid.
const TEST_EVIDENCE_MARKER_RE =
	/\bPASS\b|\bFAIL\b|✓|\S+\.\w+:\d+|^\s*\S+:\s*(pass|fail)\b/m;

/** Returns the text between `heading` and the next `## ` heading (or EOF), or null if `heading` isn't present. Shared by both the reports/ and (future, T-115) blocked/ structure checks. */
export function extractSection(
	content: string,
	heading: string,
): string | null {
	const start = content.indexOf(heading);
	if (start === -1) return null;
	const afterHeading = start + heading.length;
	const nextHeadingRelative = content.slice(afterHeading).search(/^## /m);
	const end =
		nextHeadingRelative === -1
			? content.length
			: afterHeading + nextHeadingRelative;
	return content.slice(afterHeading, end);
}

export function findPlaceholder(content: string): string | null {
	const stripped = content
		.replace(INLINE_CODE_SPAN_RE, "")
		.replace(DOUBLE_QUOTED_SPAN_RE, "");
	return stripped.match(PLACEHOLDER_RE)?.[0] ?? null;
}

export function hasRealisticTestEvidence(section: string): boolean {
	return TEST_EVIDENCE_MARKER_RE.test(section);
}

export interface ValidateReportStructureOptions {
	/** Whether to also apply the test-evidence heuristic to a `## Test evidence` section — true for REPORT_TEMPLATE.md's shape, false for BLOCKED_TEMPLATE.md's (no such section). */
	checkTestEvidence: boolean;
}

/**
 * Structural completeness check against a template's required headings —
 * reused as-is by T-115 for BLOCKED_TEMPLATE.md's shape against
 * `Docs/tickets/blocked/*.md` (that half's actual pre-flight wiring is out
 * of this ticket's scope; only this reusable check is, per this ticket's
 * own Scope note). Not "is the content true" — that's T-113/T-114.
 */
export function validateReportStructure(
	content: string,
	requiredHeadings: string[],
	opts: ValidateReportStructureOptions,
): string[] {
	const issues: string[] = [];

	for (const heading of requiredHeadings) {
		if (!content.includes(heading)) {
			issues.push(`missing required section: ${heading}`);
		}
	}

	const placeholder = findPlaceholder(content);
	if (placeholder !== null) {
		issues.push(`leftover template placeholder text: ${placeholder}`);
	}

	if (opts.checkTestEvidence) {
		const section = extractSection(content, "## Test evidence");
		if (section !== null && !hasRealisticTestEvidence(section)) {
			issues.push(
				"## Test evidence section doesn't look like real command output (no PASS/FAIL/✓/file:line marker found) — a bare claim like \"all tests pass\" isn't sufficient",
			);
		}
	}

	return issues;
}

export interface ReportGuardDeps {
	/** The PR's head branch name — ticket-implementation PRs only, same feat/* branch-prefix detection as scope-guard.ts (T-111). */
	headBranch: string;
	changedFiles: () => ChangedFile[];
	readFile: (path: string) => string | null;
}

export interface ReportGuardResult {
	ok: boolean;
	failures: string[];
}

/** The CI job's real entry function — everything `main()` does besides argv/exit wiring. Called directly by tests with synthetic-diff deps, and by `main()` with real git deps. */
export function runReportGuard(deps: ReportGuardDeps): ReportGuardResult {
	const failures: string[] = [];

	if (!deps.headBranch.startsWith("feat/")) {
		return { ok: true, failures };
	}

	const addedReports = deps
		.changedFiles()
		.filter((f) => f.status === "added" && REPORT_FILE_RE.test(f.path));

	for (const file of addedReports) {
		const content = deps.readFile(file.path);
		if (content === null) continue;

		const issues = validateReportStructure(content, REQUIRED_REPORT_HEADINGS, {
			checkTestEvidence: true,
		});
		for (const issue of issues) {
			failures.push(`${file.path}: ${issue}`);
		}
	}

	return { ok: failures.length === 0, failures };
}

function realDeps(baseRef: string, headBranch: string): ReportGuardDeps {
	const repoRoot = resolveRepoRoot();
	return {
		headBranch,
		changedFiles: () => gitChangedFiles(repoRoot, baseRef),
		readFile: (path) => readRepoFile(repoRoot, path),
	};
}

function printResult(result: ReportGuardResult): void {
	for (const failure of result.failures) {
		console.error(`❌ ${failure}`);
	}
	if (result.ok) {
		console.log("✅ Report guard passed.");
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const baseRef = process.argv[2] ?? "origin/develop";
	const headBranch = process.argv[3] ?? "";
	const result = runReportGuard(realDeps(baseRef, headBranch));
	printResult(result);
	process.exit(result.ok ? 0 : 1);
}
