// Layout: constants → exported types → exported logic → private CLI wiring →
// CLI entry. checkBulletCitation/runExitConditionGuard are exported (Shape
// 1, .claude/rules/scripts.md) — those are what
// exit-condition-guard.test.ts calls.
import {
	type ChangedFile,
	gitChangedFiles,
	parseBulletList,
	readRepoFile,
	resolveRepoRoot,
} from "./guard-utils.js";
import { extractSection } from "./report-guard.js";
import { findTicketFile } from "./scope-guard.js";

const REPORT_FILE_RE = /^Docs\/tickets\/reports\/(T-\d+)-.*\.md$/;
const EXIT_CONDITION_HEADING = "## Exit condition check";
const TICKET_EXIT_CONDITION_RE = /^Exit condition\b.*:\s*$/m;

// A bullet claiming a specific test's existence cites a `*.test.ts[x]` path,
// optionally with a `:line` suffix — the "common phrasing" the ticket's own
// Scope names (e.g. "see search.integration.test.ts:84"). Not anchored to
// backticks: a citation is often backtick-quoted in practice (report-guard.ts's
// own bullets), but the backticks aren't part of the path itself.
const FILE_CITATION_RE = /([\w./-]+\.test\.tsx?)(?::(\d+))?/;
// The test name a citing bullet usually quotes alongside the file (mirrors
// report-guard.ts's own bullets) — the first double-quoted span in the bullet.
const TEST_NAME_RE = /"([^"]+)"/;

/** Returns the raw text of a ticket's `Exit condition (machine-checkable):` bullet block, or null if the field isn't present. Terminates at the first blank line, same as TICKET_SPEC.md's field shape (a blank line separates it from `Iteration cap:`). */
function extractTicketExitConditionBlock(content: string): string | null {
	const match = content.match(TICKET_EXIT_CONDITION_RE);
	if (match?.index === undefined) return null;
	const rest = content.slice(match.index + match[0].length);
	const blankLineIdx = rest.search(/\n\s*\n/);
	return blankLineIdx === -1 ? rest : rest.slice(0, blankLineIdx);
}

export interface ExitConditionIssue {
	bullet: string;
	message: string;
}

export interface ExitConditionGuardResult {
	ok: boolean;
	failures: ExitConditionIssue[];
	/** Bullets that don't name a specific file/test — flagged, not failed, per the ticket's own exit condition ("a purely behavioral bullet passes with an 'unverifiable mechanically' annotation, not a failure"). */
	unverifiable: string[];
	/** Non-blocking: the report's Exit condition check section has fewer bullets than the ticket's own Exit condition: field — may mean an exit condition went unaddressed, but this job can't know that for certain (a report is free to fold two ticket bullets into one), so it's a signal for review, not a failure. */
	warnings: string[];
}

export interface ExitConditionGuardDeps {
	/** The PR's head branch name — ticket-implementation PRs only, same feat/* detection as scope-guard.ts/report-guard.ts. */
	headBranch: string;
	changedFiles: () => ChangedFile[];
	readFile: (path: string) => string | null;
}

/**
 * Checks a single `## Exit condition check` bullet's file/test-name citation
 * (if any) against the PR's actual diff. Returns null when the bullet
 * doesn't name a specific file (a purely behavioral claim — nothing
 * mechanical to check here, that's the `reviewer` subagent's job) or when
 * the citation checks out; otherwise a human-readable failure message.
 */
export function checkBulletCitation(
	bullet: string,
	changed: ChangedFile[],
	readFile: (path: string) => string | null,
): string | null {
	const fileMatch = bullet.match(FILE_CITATION_RE);
	if (!fileMatch?.[1]) return null;

	const citedPath = fileMatch[1];
	const diffFile = changed.find(
		(f) => f.status !== "deleted" && f.path.endsWith(citedPath),
	);
	if (!diffFile) {
		return `claims "${citedPath}" but no such file is present in the PR's diff`;
	}

	const testNameMatch = bullet.match(TEST_NAME_RE);
	if (!testNameMatch?.[1]) return null; // file exists in the diff — nothing further to verify

	const content = readFile(diffFile.path);
	if (content === null || !content.includes(testNameMatch[1])) {
		return `claims a test named "${testNameMatch[1]}" in ${diffFile.path}, but that text doesn't appear in the file`;
	}

	return null;
}

/** The CI job's real entry function — everything `main()` does besides argv/exit wiring. Called directly by tests with synthetic-diff deps, and by `main()` with real git deps. */
export function runExitConditionGuard(
	deps: ExitConditionGuardDeps,
): ExitConditionGuardResult {
	const failures: ExitConditionIssue[] = [];
	const unverifiable: string[] = [];
	const warnings: string[] = [];

	if (!deps.headBranch.startsWith("feat/")) {
		return { ok: true, failures, unverifiable, warnings };
	}

	const changed = deps.changedFiles();
	const addedReports = changed.filter(
		(f) => f.status === "added" && REPORT_FILE_RE.test(f.path),
	);
	if (addedReports.length === 0) {
		return { ok: true, failures, unverifiable, warnings };
	}

	const ticketFile = findTicketFile(changed);
	const ticketContent =
		ticketFile !== null ? deps.readFile(ticketFile.path) : null;
	const ticketBullets =
		ticketContent !== null
			? parseBulletList(extractTicketExitConditionBlock(ticketContent) ?? "")
			: [];

	for (const report of addedReports) {
		const content = deps.readFile(report.path);
		if (content === null) continue;

		const section = extractSection(content, EXIT_CONDITION_HEADING);
		if (section === null) continue; // structurally incomplete — report-guard.ts's (T-112) job, not this one's

		const reportBullets = parseBulletList(section);

		if (
			ticketBullets.length > 0 &&
			reportBullets.length < ticketBullets.length
		) {
			warnings.push(
				`${report.path}: ## Exit condition check has ${reportBullets.length} bullet(s), but the ticket's own Exit condition: field has ${ticketBullets.length} — some exit conditions may be unaddressed`,
			);
		}

		for (const bullet of reportBullets) {
			const issue = checkBulletCitation(bullet, changed, deps.readFile);
			if (issue !== null) {
				failures.push({ bullet, message: `${report.path}: ${issue}` });
			} else if (!FILE_CITATION_RE.test(bullet)) {
				unverifiable.push(bullet);
			}
		}
	}

	return { ok: failures.length === 0, failures, unverifiable, warnings };
}

function realDeps(baseRef: string, headBranch: string): ExitConditionGuardDeps {
	const repoRoot = resolveRepoRoot();
	return {
		headBranch,
		changedFiles: () => gitChangedFiles(repoRoot, baseRef),
		readFile: (path) => readRepoFile(repoRoot, path),
	};
}

function printResult(result: ExitConditionGuardResult): void {
	for (const bullet of result.unverifiable) {
		console.log(`ℹ️  unverifiable mechanically: ${bullet}`);
	}
	for (const warning of result.warnings) {
		console.warn(`⚠️  ${warning}`);
	}
	for (const failure of result.failures) {
		console.error(`❌ ${failure.message}\n   (${failure.bullet})`);
	}
	if (result.ok) {
		console.log("✅ Exit condition guard passed.");
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const baseRef = process.argv[2] ?? "origin/develop";
	const headBranch = process.argv[3] ?? "";
	const result = runExitConditionGuard(realDeps(baseRef, headBranch));
	printResult(result);
	process.exit(result.ok ? 0 : 1);
}
