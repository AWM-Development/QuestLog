import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Every CI guard job's real (non-test) wiring needs this: its CLI entry runs
// via `pnpm --filter @questlog/core run ci-*-guard`, and `pnpm --filter`
// shifts the child process's cwd to packages/core, not the repo root — every
// repo-relative path a guard touches must be resolved against this, not
// process.cwd(). Full incident writeup: Docs/IMPLEMENTATION_NOTES.md:1010.
export function resolveRepoRoot(): string {
	return execFileSync("git", ["rev-parse", "--show-toplevel"], {
		encoding: "utf-8",
	}).trim();
}

/** Reads a repo-relative file's current (post-diff) content, or null if it doesn't exist. Shared by every guard job's realDeps(). */
export function readRepoFile(repoRoot: string, path: string): string | null {
	const abs = join(repoRoot, path);
	return existsSync(abs) ? readFileSync(abs, "utf-8") : null;
}
