// Layout: constants → exported types → exported logic → real-worktree
// orchestration (untested directly, see note below) → private CLI wiring →
// CLI entry. Only the functions imported by red-check-guard.test.ts are
// exported (Shape 1, .claude/rules/scripts.md).
//
// runRedCheckGuard() is the testable core — every branch is exercised with
// injected deps, same pattern as scope-guard.ts/report-guard.ts. The
// worktree-checkout + vitest-subprocess plumbing behind
// runTestAgainstPreChangeWorktree() (real deps only) is pure
// orchestration around git/vitest with nothing first-party to assert
// against — the same Shape-1 exception db:migrate.ts relies on
// (.claude/rules/scripts.md) — verified by actually running it, not unit
// tests. Why this job exists / scope boundary: Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Resolution (Q2).
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
	type ChangedFile,
	gitChangedFiles,
	readRepoFile,
	resolveRepoRoot,
} from "./guard-utils.js";

const TEST_FILE_RE = /\.test\.tsx?$/;
// Deliberately loose (matches `expect(` and any `assert`/`assert.foo(` call) —
// a simple grep-based heuristic per this ticket's Scope, not a real parse.
const ASSERTION_RE = /\b(expect|assert)\s*[.(]/g;

/** Repo-relative test files this diff added or modified — deleted/renamed test files aren't in scope (nothing to red-check). */
export function findTouchedTestFiles(changed: ChangedFile[]): ChangedFile[] {
	return changed.filter(
		(f) =>
			(f.status === "added" || f.status === "modified") &&
			TEST_FILE_RE.test(f.path),
	);
}

export function countAssertions(content: string): number {
	return content.match(ASSERTION_RE)?.length ?? 0;
}

/**
 * A touched test file is exempt from the red-check when it's a pure refactor
 * of existing test code — assertion count unchanged or lower than develop's
 * pre-change version of the same file. `baseContent === null` means the file
 * is new in this diff (no pre-change version), so it's never exempt — a
 * brand-new test file is exactly what this job exists to check.
 */
export function isAssertionCountExempt(
	baseContent: string | null,
	headContent: string,
): boolean {
	if (baseContent === null) return false;
	return countAssertions(headContent) <= countAssertions(baseContent);
}

export interface RedCheckGuardDeps {
	/** The PR's head branch name — ticket-implementation PRs only, same feat/* branch-prefix detection as scope-guard.ts/report-guard.ts (T-111/T-112). */
	headBranch: string;
	changedFiles: () => ChangedFile[];
	/** Current (post-diff, PR's own) content of a file, or null if it doesn't exist. */
	readFile: (path: string) => string | null;
	/** develop's pre-change content of the same path, or null if the file is new in this diff. */
	readBaseFile: (path: string) => string | null;
	/** Runs exactly this one test file against develop's pre-change implementation (this file's own PR content copied on top of that source tree). Returns true if it failed there — the desired signal, proving the test exercises genuinely new behavior. */
	runTestFileAgainstPreChangeSource: (path: string) => boolean;
}

export interface RedCheckGuardResult {
	ok: boolean;
	failures: string[];
	/** Touched test files exempted via the assertion-count refactor rule — informational, not a failure. */
	exempted: string[];
}

/** The CI job's real entry function — everything `main()` does besides argv/exit wiring. Called directly by tests with synthetic-diff deps, and by `main()` with real git/vitest deps. */
export function runRedCheckGuard(deps: RedCheckGuardDeps): RedCheckGuardResult {
	if (!deps.headBranch.startsWith("feat/")) {
		return { ok: true, failures: [], exempted: [] };
	}

	const touched = findTouchedTestFiles(deps.changedFiles());
	if (touched.length === 0) {
		return { ok: true, failures: [], exempted: [] };
	}

	const exempted: string[] = [];
	const checked: string[] = [];
	for (const file of touched) {
		const headContent = deps.readFile(file.path);
		if (headContent === null) continue; // gone by the time this ran — nothing to check

		const baseContent = deps.readBaseFile(file.path);
		if (isAssertionCountExempt(baseContent, headContent)) {
			exempted.push(file.path);
			continue;
		}
		checked.push(file.path);
	}

	// Every touched test file was a pure refactor — Scope's explicit exemption.
	if (checked.length === 0) {
		return { ok: true, failures: [], exempted };
	}

	const anyFailedAgainstPreChangeSource = checked.some((path) =>
		deps.runTestFileAgainstPreChangeSource(path),
	);

	if (!anyFailedAgainstPreChangeSource) {
		return {
			ok: false,
			failures: [
				`none of this PR's touched test files (${checked.join(", ")}) fail against develop's pre-change implementation — this looks like a test written after the implementation, or one that doesn't actually exercise new behavior`,
			],
			exempted,
		};
	}

	return { ok: true, failures: [], exempted };
}

// ── Real-worktree orchestration (realDeps() only, not unit-tested — see file header) ──

/** Repo-root-relative node_modules dirs whose presence lets vitest resolve without a fresh install in the temp worktree — a test-only diff never touches dependencies, so the main checkout's install is still valid there. */
function findNodeModulesDirs(repoRoot: string): string[] {
	const candidates = ["node_modules"];
	for (const scope of ["apps", "packages"]) {
		const scopeDir = join(repoRoot, scope);
		if (!existsSync(scopeDir)) continue;
		for (const name of readdirSync(scopeDir)) {
			candidates.push(join(scope, name, "node_modules"));
		}
	}
	return candidates.filter((rel) => existsSync(join(repoRoot, rel)));
}

function linkNodeModules(repoRoot: string, worktreeDir: string): void {
	for (const rel of findNodeModulesDirs(repoRoot)) {
		const target = join(worktreeDir, rel);
		if (existsSync(target)) continue; // already present via the worktree checkout itself
		mkdirSync(dirname(target), { recursive: true });
		symlinkSync(join(repoRoot, rel), target, "dir");
	}
}

/** Which package dir (repo-relative) owns `path` — the first two path segments (apps/<name> or packages/<name>), matching this repo's workspace layout (pnpm-workspace.yaml). */
function packageDirFor(path: string): string {
	const [scope, name] = path.split("/");
	return `${scope}/${name}`;
}

function runTestAgainstPreChangeWorktree(
	repoRoot: string,
	baseRef: string,
	path: string,
	headContent: string,
): boolean {
	const worktreeDir = mkdtempSync(join(tmpdir(), "red-check-"));
	execFileSync(
		"git",
		["worktree", "add", "--detach", "-q", worktreeDir, baseRef],
		{
			cwd: repoRoot,
		},
	);
	try {
		linkNodeModules(repoRoot, worktreeDir);

		const abs = join(worktreeDir, path);
		mkdirSync(dirname(abs), { recursive: true });
		writeFileSync(abs, headContent);

		const relativePackageDir = packageDirFor(path);
		const packageDir = join(worktreeDir, relativePackageDir);
		const relativeToPackage = path.slice(relativePackageDir.length + 1);
		try {
			execFileSync("pnpm", ["exec", "vitest", "run", relativeToPackage], {
				cwd: packageDir,
				stdio: "pipe",
			});
			return false; // passed against pre-change source — didn't prove new behavior
		} catch {
			return true; // vitest exited non-zero — this is the desired red signal
		}
	} finally {
		execFileSync("git", ["worktree", "remove", "--force", worktreeDir], {
			cwd: repoRoot,
		});
	}
}

function realDeps(baseRef: string, headBranch: string): RedCheckGuardDeps {
	const repoRoot = resolveRepoRoot();
	const readFile = (path: string) => readRepoFile(repoRoot, path);
	return {
		headBranch,
		changedFiles: () => gitChangedFiles(repoRoot, baseRef),
		readFile,
		readBaseFile: (path) => {
			try {
				return execFileSync("git", ["show", `${baseRef}:${path}`], {
					encoding: "utf-8",
					cwd: repoRoot,
				});
			} catch {
				return null; // new file in this diff — no pre-change version
			}
		},
		runTestFileAgainstPreChangeSource: (path) => {
			const headContent = readFile(path);
			if (headContent === null) return false;
			return runTestAgainstPreChangeWorktree(
				repoRoot,
				baseRef,
				path,
				headContent,
			);
		},
	};
}

function printResult(result: RedCheckGuardResult): void {
	for (const path of result.exempted) {
		console.log(
			`ℹ️  ${path} exempted — refactor of existing test, no new assertions`,
		);
	}
	for (const failure of result.failures) {
		console.error(`❌ ${failure}`);
	}
	if (result.ok) {
		console.log("✅ Red-check passed.");
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const baseRef = process.argv[2] ?? "origin/develop";
	const headBranch = process.argv[3] ?? "";
	const result = runRedCheckGuard(realDeps(baseRef, headBranch));
	printResult(result);
	process.exit(result.ok ? 0 : 1);
}
