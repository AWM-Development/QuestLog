import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	gitChangedFiles,
	readRepoFile,
	resolveRepoRoot,
} from "./guard-utils.js";

describe("resolveRepoRoot", () => {
	it("returns this repo's real root", () => {
		const root = resolveRepoRoot();
		expect(existsSync(join(root, "pnpm-workspace.yaml"))).toBe(true);
	});
});

describe("readRepoFile", () => {
	let dir: string | undefined;

	afterEach(() => {
		if (dir) rmSync(dir, { recursive: true, force: true });
		dir = undefined;
	});

	it("reads a file's content relative to repoRoot", () => {
		dir = mkdtempSync(join(tmpdir(), "guard-utils-test-"));
		mkdirSync(join(dir, "sub"), { recursive: true });
		writeFileSync(join(dir, "sub", "file.txt"), "hello");
		expect(readRepoFile(dir, "sub/file.txt")).toBe("hello");
	});

	it("returns null when the file doesn't exist", () => {
		dir = mkdtempSync(join(tmpdir(), "guard-utils-test-"));
		expect(readRepoFile(dir, "missing.txt")).toBeNull();
	});
});

describe("gitChangedFiles", () => {
	let dir: string | undefined;

	afterEach(() => {
		if (dir) rmSync(dir, { recursive: true, force: true });
		dir = undefined;
	});

	/** A throwaway repo with a base commit and a second commit that adds, modifies, and removes a file — enough to exercise all three statuses gitChangedFiles maps. */
	function makeRepoWithDiff(): string {
		const root = mkdtempSync(join(tmpdir(), "guard-utils-git-test-"));
		const git = (...args: string[]) =>
			execFileSync("git", args, { cwd: root, encoding: "utf-8" });
		git("init", "-q");
		git("config", "user.email", "test@example.com");
		git("config", "user.name", "Test");
		writeFileSync(join(root, "kept.txt"), "kept");
		writeFileSync(join(root, "removed.txt"), "gone soon");
		git("add", ".");
		git("commit", "-q", "-m", "base");

		writeFileSync(join(root, "added.txt"), "new");
		writeFileSync(join(root, "kept.txt"), "kept, edited");
		rmSync(join(root, "removed.txt"));
		git("add", "-A");
		git("commit", "-q", "-m", "second");

		return root;
	}

	it("maps git diff --name-status into {path, status}[] against a base ref", () => {
		dir = makeRepoWithDiff();
		const changed = gitChangedFiles(dir, "HEAD~1").sort((a, b) =>
			a.path.localeCompare(b.path),
		);
		expect(changed).toEqual([
			{ path: "added.txt", status: "added" },
			{ path: "kept.txt", status: "modified" },
			{ path: "removed.txt", status: "deleted" },
		]);
	});
});
