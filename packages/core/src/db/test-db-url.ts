import { sep } from "node:path";

const HOST = "localhost";
const DEFAULT_PORT = 5433;
const USER = "questlog";
const PASSWORD = "questlog";
// Both this repo's tmp/worktrees/<name> and the desktop app's own
// .claude/worktrees/<name> are real worktree layouts in use.
const WORKTREES_MARKERS = [
	`${sep}tmp${sep}worktrees${sep}`,
	`${sep}.claude${sep}worktrees${sep}`,
];
// Mirrors the old checksum-derived-port design's own range (T-072), widened
// from 500 for cheap extra collision margin — see resolveWorktreePort.
const PORT_RANGE = 1000;

/**
 * Deterministic rolling hash (`hash = hash*31 + charCode`, wrapped to 32
 * bits every step) — chosen over `cksum`/`crc32` because it has to produce
 * the exact same output in this file *and* in `scripts/test-db-names.sh`'s
 * bash mirror, and a hand-written polynomial hash is trivial to keep
 * bit-identical across both, unlike reimplementing a real CRC. Verified
 * live before relying on it: both sides hashed five sample worktree names
 * to identical results.
 */
function rollingHash32(input: string): number {
	let hash = 0;
	for (let i = 0; i < input.length; i++) {
		hash = (Math.imul(hash, 31) + input.charCodeAt(i)) >>> 0;
	}
	return hash;
}

// Extracts the worktree name from either recognized layout; null outside one.
function worktreeNameFromCwd(cwd: string): string | null {
	for (const marker of WORKTREES_MARKERS) {
		const idx = cwd.indexOf(marker);
		if (idx === -1) continue;
		const rest = cwd.slice(idx + marker.length);
		const name = rest.split(sep)[0];
		if (name) return name;
	}
	return null;
}

/**
 * Derives a worktree's Postgres port straight from its working directory —
 * never from an env var a session might forget to export. A `vitest run`
 * invoked directly, with no `session-db-local.sh`/env-export script ever
 * sourced, still resolves the right port (this replaced the
 * checksum-derived-port design a silently-unset `QUESTLOG_PG_PORT` kept
 * defaulting past, most recently `T-109`). Not collision-proof (a hash into
 * a 1000-wide range) — `session-db-local.sh`'s own provisioning loop checks for
 * a real collision against another running worktree's Postgres and fails
 * loudly rather than silently sharing a port.
 *
 * Returns null outside a worktree (primary checkout, CI) — `resolvePort`
 * falls back to `DEFAULT_PORT` in that case, same as before this existed.
 *
 * `scripts/test-db-names.sh`'s `worktree_port()` mirrors this exact
 * derivation for the bash-side provisioning loop in `session-db-local.sh` —
 * keep both in sync if this logic ever changes.
 */
export function resolveWorktreePort(
	cwd: string = process.cwd(),
): number | null {
	const name = worktreeNameFromCwd(cwd);
	if (!name) return null;
	return DEFAULT_PORT + (rollingHash32(name) % PORT_RANGE) + 1;
}

// Resolved per call, not cached — so vi.stubEnv and late overrides both work
// (T-072). `QUESTLOG_PG_PORT` stays as a manual override for the rare case
// that needs one; the worktree-derived port is what makes it unnecessary in
// the common case.
function resolvePort(cwd?: string): number {
	const raw = process.env.QUESTLOG_PG_PORT;
	if (raw) {
		const parsed = Number(raw);
		if (Number.isFinite(parsed)) return parsed;
	}
	return resolveWorktreePort(cwd) ?? DEFAULT_PORT;
}

/**
 * Builds the local Postgres connection string for a given database name.
 * Single source of truth for the
 * `postgresql://questlog:questlog@localhost:5433/<dbname>` literal that used
 * to be hand-typed across both packages' vitest configs, test-helpers.ts's
 * fallback, and migrate.ts's fallback — collapsed here so all of them stay
 * in sync if the local stack's host/port/credentials ever change. Resolves
 * the port from the worktree's own working directory (`resolveWorktreePort`)
 * — no call-site changes needed, and no env var to lose.
 */
export function testDbUrl(dbname: string, cwd?: string): string {
	return `postgresql://${USER}:${PASSWORD}@${HOST}:${resolvePort(cwd)}/${dbname}`;
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
