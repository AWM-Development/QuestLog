import { execFileSync } from "node:child_process";
import { readRepoFile, resolveRepoRoot } from "./guard-utils.js";

const TICKET_FILE_RE = /^Docs\/tickets\/(in-progress|done)\/(T-\d+)-.*\.md$/;
const CONTEXT_FILES_HEADER_RE = /^Context files/;
const CONTEXT_FILES_ITEM_RE = /^\s+-\s*(\S+)/;

// EXECUTOR_ROUTINE.md's Definition of Done requires these on every
// ticket-implementation PR regardless of the ticket's actual scope, and no
// ticket ever lists them under its own Context files: — confirmed noisy on
// the first real PR this job ran against (Docs/IMPLEMENTATION_NOTES.md § T-111).
const STANDARD_WRAPUP_FILES = new Set([
	"CHANGELOG.md",
	"Docs/IMPLEMENTATION_NOTES.md",
]);
const MILESTONE_DOC_RE = /^Docs\/milestones\/.*\.md$/;

function isStandardWrapupFile(path: string): boolean {
	return STANDARD_WRAPUP_FILES.has(path) || MILESTONE_DOC_RE.test(path);
}

/** Parses the `Context files (load ONLY these):` block into its bare paths — dropping any trailing `§`/parenthetical explanation, per TICKET_SPEC.md's field format. */
export function parseContextFiles(content: string): string[] {
	const lines = content.split("\n");
	const headerIdx = lines.findIndex((line) =>
		CONTEXT_FILES_HEADER_RE.test(line),
	);
	if (headerIdx === -1) return [];

	const paths: string[] = [];
	for (let i = headerIdx + 1; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined || line.trim() === "") break;
		const match = line.match(CONTEXT_FILES_ITEM_RE);
		if (match?.[1]) paths.push(match[1]);
	}
	return paths;
}

export type ChangeStatus = "added" | "modified" | "deleted" | "renamed";

export interface ChangedFile {
	path: string;
	status: ChangeStatus;
}

export interface ScopeGuardDeps {
	/** The PR's head branch name — ticket-implementation PRs use `feat/*` (TICKET_SPEC.md's "Branch naming" convention, same signal `/lineup` relies on). */
	headBranch: string;
	/** The PR's base branch name (e.g. "develop"), not a ref — CRITICAL BRANCH RULES requires this to always be `develop`. */
	baseBranchName: string;
	changedFiles: () => ChangedFile[];
	/** Current (post-diff) content of a file, or null if it doesn't exist / wasn't read. */
	readFile: (path: string) => string | null;
}

export interface ScopeGuardResult {
	ok: boolean;
	failures: string[];
	warnings: string[];
}

function findTicketFile(changed: ChangedFile[]): ChangedFile | null {
	const matches = changed.filter((f) => TICKET_FILE_RE.test(f.path));
	// A shipped ticket's diff against develop shows it only under done/ (added) —
	// in-progress/ never appears in a normal wrap-up diff since develop's tree
	// never had it there either. The in-progress/ case is kept as a fallback for
	// a PR opened before the ticket reached done/, an edge case EXECUTOR_ROUTINE.md
	// doesn't otherwise produce but this guard shouldn't silently mishandle.
	return (
		matches.find((f) => f.path.startsWith("Docs/tickets/done/")) ??
		matches.find((f) => f.path.startsWith("Docs/tickets/in-progress/")) ??
		null
	);
}

/** The CI job's real entry function — everything `main()` does besides argv/exit wiring. Called directly by tests with synthetic-diff deps, and by `main()` with real git deps. */
export function runScopeGuard(deps: ScopeGuardDeps): ScopeGuardResult {
	const failures: string[] = [];
	const warnings: string[] = [];

	// Not a ticket-implementation PR (a planning/gate PR) — none of this job's
	// checks apply. Scope: "for a PR whose diff touches a ticket file... —
	// distinguish by branch name prefix feat/*".
	if (!deps.headBranch.startsWith("feat/")) {
		return { ok: true, failures, warnings };
	}

	const changed = deps.changedFiles();

	if (deps.baseBranchName !== "develop") {
		failures.push(
			`PR base branch is "${deps.baseBranchName}", not "develop" — CRITICAL BRANCH RULES requires ticket branches to PR into develop`,
		);
	}

	for (const file of changed) {
		if (file.path.startsWith("Docs/mockups/")) {
			failures.push(
				`diff touches ${file.path} — Docs/mockups/ is read-only to agents`,
			);
		}
	}

	const ticketFile = findTicketFile(changed);
	if (ticketFile !== null) {
		const content = deps.readFile(ticketFile.path);
		const contextFiles = new Set(
			content !== null ? parseContextFiles(content) : [],
		);
		const addedFiles = new Set(
			changed.filter((f) => f.status === "added").map((f) => f.path),
		);

		for (const file of changed) {
			if (file.path === ticketFile.path) continue;
			if (file.path.startsWith("Docs/mockups/")) continue; // already a hard failure above
			if (addedFiles.has(file.path)) continue;
			if (contextFiles.has(file.path)) continue;
			if (isStandardWrapupFile(file.path)) continue;
			warnings.push(
				`${file.path} is outside ${ticketFile.path}'s declared Context files: and wasn't newly created by this diff`,
			);
		}
	}

	return { ok: failures.length === 0, failures, warnings };
}

function gitChangedFiles(repoRoot: string, baseRef: string): ChangedFile[] {
	const output = execFileSync(
		"git",
		["diff", "--name-status", `${baseRef}...HEAD`],
		{ encoding: "utf-8", cwd: repoRoot },
	);
	const statusMap: Record<string, ChangeStatus> = {
		A: "added",
		M: "modified",
		D: "deleted",
		R: "renamed",
	};
	return output
		.split("\n")
		.filter((line) => line.length > 0)
		.map((line) => {
			const [rawStatus, ...pathParts] = line.split("\t");
			// A rename line is "R100\told\tnew" — the new path is what matters here.
			const path = pathParts[pathParts.length - 1] ?? "";
			const status = statusMap[(rawStatus ?? "").charAt(0)] ?? "modified";
			return { path, status };
		})
		.filter((f) => f.path.length > 0);
}

function realDeps(
	baseRef: string,
	headBranch: string,
	baseBranchName: string,
): ScopeGuardDeps {
	const repoRoot = resolveRepoRoot();
	return {
		headBranch,
		baseBranchName,
		changedFiles: () => gitChangedFiles(repoRoot, baseRef),
		readFile: (path) => readRepoFile(repoRoot, path),
	};
}

function printResult(result: ScopeGuardResult): void {
	for (const warning of result.warnings) {
		console.warn(`⚠️  ${warning}`);
	}
	for (const failure of result.failures) {
		console.error(`❌ ${failure}`);
	}
	if (result.ok) {
		console.log("✅ Scope guard passed.");
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const baseRef = process.argv[2] ?? "origin/develop";
	const headBranch = process.argv[3] ?? "";
	const baseBranchName = process.argv[4] ?? "develop";
	const result = runScopeGuard(realDeps(baseRef, headBranch, baseBranchName));
	printResult(result);
	process.exit(result.ok ? 0 : 1);
}
