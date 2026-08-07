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

export type ChangeStatus = "added" | "modified" | "deleted" | "renamed";

export interface ChangedFile {
	path: string;
	status: ChangeStatus;
}

/** Parses `git diff --name-status <baseRef>...HEAD` into {path, status}[]. Shared by every guard job whose check operates over a file-level diff (scope-guard.ts, report-guard.ts) — previously reimplemented near-identically in each. */
export function gitChangedFiles(
	repoRoot: string,
	baseRef: string,
): ChangedFile[] {
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
