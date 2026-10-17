import { spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveRepoRoot } from "./guard-utils.js";

const repoRoot = resolveRepoRoot();

// Answers the handful of queries db_readiness_issue and the pgvector check
// issue, steered by STUB_* env vars so one stub covers every failure class.
const PSQL_STUB = `#!/bin/bash
query="\${@: -1}"
case "$query" in
  *"FROM pg_database"*)
    [[ "$query" == *"'\${STUB_MISSING_DB:-__none__}'"* ]] && exit 0
    echo 1 ;;
  *"FROM pg_extension"*) echo 1 ;;
  *"__drizzle_migrations"*) echo "\${STUB_MIGRATIONS:-3}" ;;
  *"pg_available_extensions"*) echo "\${STUB_PGVECTOR:-0.8.5}" ;;
esac
`;

describe("scripts/executor-env-preflight.sh", () => {
	let fixture: string;
	let stubs: string;

	const write = (path: string, body: string, mode = 0o644) => {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, body);
		chmodSync(path, mode);
	};

	beforeEach(() => {
		fixture = mkdtempSync(join(tmpdir(), "preflight-test-"));
		stubs = join(fixture, "stubs");
		for (const f of [
			"scripts/executor-env-preflight.sh",
			"scripts/test-db-names.sh",
			"scripts/db-readiness.sh",
			"packages/core/src/db/migrate.ts",
		]) {
			mkdirSync(dirname(join(fixture, f)), { recursive: true });
			copyFileSync(join(repoRoot, f), join(fixture, f));
		}
		write(
			join(fixture, "docker-compose.yml"),
			"image: pgvector/pgvector:0.8.5-pg16\n",
		);
		mkdirSync(join(fixture, "node_modules"));
		write(join(stubs, "pnpm"), "#!/bin/bash\necho 9.0.0\n", 0o755);
		write(
			join(stubs, "pg_isready"),
			"#!/bin/bash\nexit ${STUB_PG_EXIT:-0}\n",
			0o755,
		);
		write(join(stubs, "sudo"), '#!/bin/bash\nshift 2\nexec "$@"\n', 0o755);
		write(join(stubs, "psql"), PSQL_STUB, 0o755);
		write(join(stubs, "git"), "#!/bin/bash\nexit ${STUB_GIT_EXIT:-0}\n", 0o755);
	});

	afterEach(() => rmSync(fixture, { recursive: true, force: true }));

	// Invoked the way EXECUTOR_ROUTINE.md Step 0 does: `bash scripts/...` from
	// the checkout root, CLAUDE_PROJECT_DIR unset.
	const run = (env: Record<string, string> = {}) => {
		const result = spawnSync("bash", ["scripts/executor-env-preflight.sh"], {
			cwd: fixture,
			encoding: "utf8",
			env: {
				PATH: `${stubs}:${dirname(process.execPath)}:/usr/bin:/bin`,
				CLAUDE_CODE_REMOTE: "true",
				...env,
			},
		});
		return { out: result.stdout.trim(), code: result.status };
	};

	it("prints ENV_OK and exits 0 on a healthy fixture", () => {
		expect(run()).toEqual({ out: "ENV_OK", code: 0 });
	});

	it("flags missing node_modules", () => {
		rmSync(join(fixture, "node_modules"), { recursive: true });
		const { out, code } = run();
		expect(out).toMatch(/^ENV_UNHEALTHY: node_modules: /);
		expect(code).toBe(1);
	});

	it("flags an unrunnable pnpm", () => {
		write(join(stubs, "pnpm"), "#!/bin/bash\nexit 127\n", 0o755);
		const { out, code } = run();
		expect(out).toMatch(/^ENV_UNHEALTHY: node_modules: pnpm/);
		expect(code).toBe(1);
	});

	it("flags Postgres not answering", () => {
		const { out, code } = run({ STUB_PG_EXIT: "2" });
		expect(out).toMatch(/^ENV_UNHEALTHY: postgres: /);
		expect(code).toBe(1);
	});

	it("flags a missing database", () => {
		const { out, code } = run({ STUB_MISSING_DB: "questlog_test_mcp" });
		expect(out).toBe(
			"ENV_UNHEALTHY: db_migrations: database questlog_test_mcp does not exist",
		);
		expect(code).toBe(1);
	});

	it("flags an unmigrated database", () => {
		const { out, code } = run({ STUB_MIGRATIONS: "0" });
		expect(out).toMatch(
			/^ENV_UNHEALTHY: db_migrations: .*no applied migrations/,
		);
		expect(code).toBe(1);
	});

	it("flags pgvector older than the pinned version", () => {
		const { out, code } = run({ STUB_PGVECTOR: "0.7.4" });
		expect(out).toMatch(
			/^ENV_UNHEALTHY: pgvector: installed 0\.7\.4 is older than/,
		);
		expect(code).toBe(1);
	});

	it("accepts pgvector newer than the pinned version", () => {
		expect(run({ STUB_PGVECTOR: "0.10.0" })).toEqual({
			out: "ENV_OK",
			code: 0,
		});
	});

	it("flags an unreachable git remote", () => {
		const { out, code } = run({ STUB_GIT_EXIT: "128" });
		expect(out).toMatch(/^ENV_UNHEALTHY: git_remote: /);
		expect(code).toBe(1);
	});

	it("flags free disk below the floor", () => {
		const { out, code } = run({ PREFLIGHT_MIN_FREE_MB: "999999999" });
		expect(out).toMatch(/^ENV_UNHEALTHY: disk: /);
		expect(code).toBe(1);
	});

	it("defers database checks outside remote/worktree contexts", () => {
		const { out, code } = run({ CLAUDE_CODE_REMOTE: "", STUB_PG_EXIT: "2" });
		expect(out).toBe("ENV_OK");
		expect(code).toBe(0);
	});
});

describe("scripts/hook-timing.sh", () => {
	const hook = (body: string) =>
		spawnSync(
			"bash",
			[
				"-c",
				`set -euo pipefail; source "${join(repoRoot, "scripts/hook-timing.sh")}"; hook_timing_install demo.sh; ${body}`,
			],
			{ encoding: "utf8" },
		);

	it("prints the timing line last on a successful exit, including an early exit 0", () => {
		const r = hook("echo working; exit 0");
		expect(r.status).toBe(0);
		expect(r.stdout.trim().split("\n").pop()).toMatch(
			/^demo\.sh: completed in [0-9]+s$/,
		);
	});

	it("prints nothing extra and preserves the code on failure", () => {
		const r = hook("exit 3");
		expect(r.status).toBe(3);
		expect(r.stdout).not.toMatch(/completed in/);
	});
});
