import { afterEach, describe, expect, it, vi } from "vitest";
import {
	FAKE_HOSTED_DB_URL,
	assertLocalDatabaseUrl,
	resolveLocalTestDbUrl,
	resolveWorktreeDbSuffix,
	testDbUrl,
} from "./test-db-url.js";

// A cwd outside any worktree — same shape CI/the primary checkout resolve to.
const PRIMARY_CWD = "/Users/alex/Documents/Code/QuestLog";
const WORKTREE_CWD = "/Users/alex/Documents/Code/QuestLog/tmp/worktrees/T-109";
const NESTED_WORKTREE_CWD =
	"/Users/alex/Documents/Code/QuestLog/tmp/worktrees/T-109/packages/core";

describe("resolveWorktreeDbSuffix", () => {
	it("returns null for a cwd outside tmp/worktrees/ (primary checkout, CI)", () => {
		expect(resolveWorktreeDbSuffix(PRIMARY_CWD)).toBeNull();
	});

	it("returns the sanitized worktree name for a cwd directly at tmp/worktrees/<name>", () => {
		expect(resolveWorktreeDbSuffix(WORKTREE_CWD)).toBe("t_109");
	});

	it("finds the worktree name regardless of how deep under it cwd is — no setup step required", () => {
		// This is the actual bug T-154 fixes: a `vitest run` invoked directly
		// from a package subdirectory, with no session-start.sh/env-export
		// script ever sourced, must still resolve the right worktree.
		expect(resolveWorktreeDbSuffix(NESTED_WORKTREE_CWD)).toBe("t_109");
	});

	it("sanitizes a hyphenated worktree name into a valid unquoted Postgres identifier", () => {
		expect(
			resolveWorktreeDbSuffix(
				"/Users/alex/Documents/Code/QuestLog/tmp/worktrees/env-redesign",
			),
		).toBe("env_redesign");
	});

	it("lowercases and strips any other non-identifier characters", () => {
		expect(
			resolveWorktreeDbSuffix(
				"/Users/alex/Documents/Code/QuestLog/tmp/worktrees/Weird.Name!",
			),
		).toBe("weird_name_");
	});

	it("truncates a very long worktree name so the suffixed db name stays under Postgres's 63-byte identifier limit", () => {
		const longName = "a".repeat(80);
		const suffix = resolveWorktreeDbSuffix(
			`/Users/alex/Documents/Code/QuestLog/tmp/worktrees/${longName}`,
		);
		expect(suffix).not.toBeNull();
		expect(suffix?.length).toBeLessThanOrEqual(24);
	});
});

describe("testDbUrl", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("builds a local Postgres connection string on the fixed port when QUESTLOG_PG_PORT is unset", () => {
		vi.stubEnv("QUESTLOG_PG_PORT", undefined);

		expect(testDbUrl("questlog_test", PRIMARY_CWD)).toBe(
			"postgresql://questlog:questlog@localhost:5433/questlog_test",
		);
	});

	it("swaps in a different database name without changing host/port/credentials", () => {
		vi.stubEnv("QUESTLOG_PG_PORT", undefined);

		expect(testDbUrl("questlog_test_mcp", PRIMARY_CWD)).toBe(
			"postgresql://questlog:questlog@localhost:5433/questlog_test_mcp",
		);
	});

	it("uses QUESTLOG_PG_PORT when set — still a valid manual override, just no longer worktree-derived", () => {
		vi.stubEnv("QUESTLOG_PG_PORT", "5501");

		expect(testDbUrl("questlog_test", PRIMARY_CWD)).toBe(
			"postgresql://questlog:questlog@localhost:5501/questlog_test",
		);
	});

	it("falls back to 5433 when QUESTLOG_PG_PORT is not a valid number", () => {
		vi.stubEnv("QUESTLOG_PG_PORT", "not-a-port");

		expect(testDbUrl("questlog_test", PRIMARY_CWD)).toBe(
			"postgresql://questlog:questlog@localhost:5433/questlog_test",
		);
	});

	it("suffixes the database name with the worktree name when cwd is inside tmp/worktrees/ — no env var required (T-154)", () => {
		vi.stubEnv("QUESTLOG_PG_PORT", undefined);

		expect(testDbUrl("questlog_test_core", WORKTREE_CWD)).toBe(
			"postgresql://questlog:questlog@localhost:5433/questlog_test_core__t_109",
		);
	});

	it("defaults cwd to process.cwd() when not given explicitly", () => {
		// This test file itself normally runs from inside a worktree in this
		// repo's real pipeline — assert only that the two call shapes agree,
		// not a hardcoded expectation about where *this* test happens to run.
		expect(testDbUrl("questlog_test")).toBe(
			testDbUrl("questlog_test", process.cwd()),
		);
	});
});

describe("assertLocalDatabaseUrl", () => {
	it("passes a dev-shaped connection string (localhost)", () => {
		expect(() =>
			assertLocalDatabaseUrl(testDbUrl("questlog_test", PRIMARY_CWD)),
		).not.toThrow();
	});

	it("passes a dev-shaped connection string (127.0.0.1)", () => {
		expect(() =>
			assertLocalDatabaseUrl(
				"postgresql://questlog:questlog@127.0.0.1:5433/questlog_test",
			),
		).not.toThrow();
	});

	it("refuses a prod-shaped connection string (hosted Neon branch)", () => {
		expect(() => assertLocalDatabaseUrl(FAKE_HOSTED_DB_URL)).toThrow(
			/non-local database host/,
		);
	});

	it("never leaks the password of a refused connection string in the thrown error", () => {
		try {
			assertLocalDatabaseUrl(FAKE_HOSTED_DB_URL);
			throw new Error("expected assertLocalDatabaseUrl to throw");
		} catch (error) {
			expect((error as Error).message).not.toContain("secretpw");
		}
	});
});

describe("resolveLocalTestDbUrl", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("prefers an explicit URL over process.env.DATABASE_URL", () => {
		vi.stubEnv("DATABASE_URL", testDbUrl("questlog_test", PRIMARY_CWD));

		expect(
			resolveLocalTestDbUrl(testDbUrl("questlog_test_mcp", PRIMARY_CWD)),
		).toBe(testDbUrl("questlog_test_mcp", PRIMARY_CWD));
	});

	it("falls back to process.env.DATABASE_URL when no explicit URL is given", () => {
		vi.stubEnv("DATABASE_URL", testDbUrl("questlog_test_mcp", PRIMARY_CWD));

		expect(resolveLocalTestDbUrl()).toBe(
			testDbUrl("questlog_test_mcp", PRIMARY_CWD),
		);
	});

	it("falls back to questlog_test when neither an explicit URL nor process.env.DATABASE_URL is set", () => {
		vi.stubEnv("DATABASE_URL", undefined);

		expect(resolveLocalTestDbUrl()).toBe(testDbUrl("questlog_test"));
	});

	it("still guards an explicit URL against a non-local host", () => {
		expect(() => resolveLocalTestDbUrl(FAKE_HOSTED_DB_URL)).toThrow(
			/non-local database host/,
		);
	});
});
