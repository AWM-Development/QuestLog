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
import { readRepoFile, resolveRepoRoot } from "./guard-utils.js";

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
