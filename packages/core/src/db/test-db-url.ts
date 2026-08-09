import { sep } from "node:path";

const HOST = "localhost";
const DEFAULT_PORT = 5433;
const USER = "questlog";
const PASSWORD = "questlog";
const WORKTREES_MARKER = `${sep}tmp${sep}worktrees${sep}`;
// Postgres's own unquoted-identifier limit is 63 bytes total; this leaves
// headroom for the longest base name this repo has (`questlog_test_observability`,
// 28 chars) plus the `__` separator.
const MAX_SUFFIX_LENGTH = 24;

// Resolved per call, not cached — so vi.stubEnv and late overrides both work (T-072).
function resolvePort(): number {
	const raw = process.env.QUESTLOG_PG_PORT;
	if (!raw) return DEFAULT_PORT;
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : DEFAULT_PORT;
}

// Postgres unquoted identifiers are lowercase letters/digits/underscores
// only — a worktree directory name like "T-109" or "env-redesign" isn't
// valid as-is.
function sanitizeForPgIdentifier(raw: string): string {
	return raw
		.toLowerCase()
		.replace(/[^a-z0-9_]/g, "_")
		.slice(0, MAX_SUFFIX_LENGTH);
}

/**
 * Derives the per-worktree database-name suffix straight from a working
 * directory — never from an env var a session might forget to export. Every
 * `tmp/worktrees/<name>/...` path (this repo's whole worktree convention,
 * `AGENTS.md` § "Session isolation") carries its own worktree name as an
 * ancestor path segment, so this needs no setup step at all: a `vitest run`
 * invoked directly, with no `session-start.sh`/env-export script ever
 * sourced, still resolves the right database (T-154 — this replaced the
 * checksum-derived-port design a silently-unset `QUESTLOG_PG_PORT` kept
 * defaulting past, most recently T-109).
 *
 * Returns null outside a worktree (primary checkout, CI) — same un-suffixed
 * database names as before T-154.
 *
 * `scripts/test-db-names.sh`'s `worktree_db_suffix()` mirrors this exact
 * derivation for the bash-side provisioning loop in `session-start.sh` —
 * keep both in sync if this logic ever changes.
 */
export function resolveWorktreeDbSuffix(
	cwd: string = process.cwd(),
): string | null {
	const idx = cwd.indexOf(WORKTREES_MARKER);
	if (idx === -1) return null;
	const rest = cwd.slice(idx + WORKTREES_MARKER.length);
	const name = rest.split(sep)[0];
	return name ? sanitizeForPgIdentifier(name) : null;
}

/**
 * Builds the local Postgres connection string for a given database name,
 * suffixed with the current worktree's name when run from inside one
 * (`resolveWorktreeDbSuffix`, T-154) — so concurrent worktrees never share a
 * physical test database, and no shell has to remember to export anything
 * for that isolation to hold. Single source of truth for the
 * `postgresql://questlog:questlog@localhost:5433/<dbname>` literal that used
 * to be hand-typed across both packages' vitest configs, test-helpers.ts's
 * fallback, and migrate.ts's fallback — collapsed here so all of them stay
 * in sync if the local stack's host/port/credentials ever change. Reads
 * `QUESTLOG_PG_PORT` as a manual port override if set (defaults to 5433,
 * the one shared instance every worktree now targets — T-154 removed the
 * per-worktree port derivation this var used to carry).
 */
export function testDbUrl(dbname: string, cwd?: string): string {
	const suffix = resolveWorktreeDbSuffix(cwd);
	const effectiveName = suffix ? `${dbname}__${suffix}` : dbname;
	return `postgresql://${USER}:${PASSWORD}@${HOST}:${resolvePort()}/${effectiveName}`;
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

/**
 * Guards test/dev-only connection paths (`test-helpers.ts`'s `createTestDb()`,
 * `global-setup.ts`'s table-truncating `setup()`) against ever running
 * against a real hosted database. Both are automated, unattended entrypoints
 * (run by the nightly ticket executor and CI on every test run) that must
 * only ever touch the local Postgres this repo's tooling provisions — never
 * a real Neon dev or prod branch, which `truncateAllTables` would otherwise
 * silently wipe. Not used by `db/index.ts` or `migrate.ts`, which legitimately
 * need to reach a real hosted database when actually deployed.
 */
export function assertLocalDatabaseUrl(connectionString: string): void {
	const { hostname } = new URL(connectionString);
	if (!LOCAL_HOSTNAMES.has(hostname)) {
		throw new Error(
			`Refusing to connect to non-local database host "${hostname}" — test/dev-only tooling must only ever target localhost or 127.0.0.1.`,
		);
	}
}

/**
 * Resolves and guards `DATABASE_URL` for the two automated entrypoints that
 * mutate the local test database (`createTestDb()`, `global-setup.ts`'s
 * `setup()`) in one place, so a future entrypoint can't resolve the URL
 * while forgetting to call {@link assertLocalDatabaseUrl}.
 *
 * `explicitUrl` lets `global-setup.ts` pass Vitest's resolved `test.env`
 * value directly — `process.env.DATABASE_URL` isn't populated yet when
 * `globalSetup` runs (Vitest applies `test.env` to `process.env` afterward),
 * so falling back to it there silently resolves to the wrong database.
 */
export function resolveLocalTestDbUrl(explicitUrl?: string): string {
	const connectionString =
		explicitUrl ?? process.env.DATABASE_URL ?? testDbUrl("questlog_test");
	assertLocalDatabaseUrl(connectionString);
	return connectionString;
}

/** Test fixture: syntactically valid, fake hosted-Neon connection string used across this module's callers' tests to exercise the reject path. */
export const FAKE_HOSTED_DB_URL =
	"postgresql://user:secretpw@ep-cool-glade-12345.us-east-2.aws.neon.tech/questlog?sslmode=require";
