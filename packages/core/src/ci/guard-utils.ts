import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Not generalized into scripts/*.sh — bash solves this cwd problem
// differently already. Full rationale: Docs/IMPLEMENTATION_NOTES.md § T-111.

// pnpm --filter shifts cwd off the repo root; every guard resolves paths
// against this instead. Full rationale: Docs/IMPLEMENTATION_NOTES.md:1010.
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
