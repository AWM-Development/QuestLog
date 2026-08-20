import dotenv from "dotenv";

const HOST = "localhost";
const DEFAULT_PORT = 5433;
const USER = "questlog";
const PASSWORD = "questlog";

let repoRootDotenvLoaded = false;

/**
 * Loads repo-root `.env` once per process, so a Vitest config file's
 * top-level `testDbUrl(...)` call (every `vitest.config.ts` in this repo
 * computes its `DATABASE_URL` this way, at config-eval time, before any
 * test or hook runs) can resolve `QUESTLOG_PG_PORT` without depending on
 * the invoking shell having it exported. It never does: the SessionStart
 * hook that derives a worktree's port (`scripts/worktree-postgres-env.sh`)
 * runs in its own subprocess, and that `export` is gone the moment the
 * hook exits — session-start.sh now pins the resolved value into the
 * worktree's own `.env` on disk instead (T-152 follow-up), which this
 * function reads. Opt-in, not a module-load side effect: call it explicitly
 * from a vitest config, before `testDbUrl()` — `test-db-url.ts` is also
 * imported by production code (`apps/server/src/observability-db.ts`) that
 * must not have its env-loading order perturbed by importing this module.
 * Resolves relative to `process.cwd()`, matching `migrate.ts`'s own
 * `dotenv.config({ path: "../../.env" })` pattern — every vitest config in
 * this repo runs with its own package/app directory as cwd, exactly two
 * levels below the repo root, so the relative path is the same everywhere.
 * No-op if `.env` is absent (CI) or already loaded this process.
 */
export function loadRepoRootDotenvForVitestConfig(): void {
	if (repoRootDotenvLoaded) return;
	repoRootDotenvLoaded = true;
	dotenv.config({ path: "../../.env" });
}

// Resolved per call, not cached — so vi.stubEnv and late overrides both work (T-072).
function resolvePort(): number {
	const raw = process.env.QUESTLOG_PG_PORT;
	if (!raw) return DEFAULT_PORT;
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : DEFAULT_PORT;
}

/**
 * Builds the local docker-compose Postgres connection string for a given
 * database name. Single source of truth for the
 * `postgresql://questlog:questlog@localhost:5433/<dbname>` literal that used
 * to be hand-typed across both packages' vitest configs, test-helpers.ts's
 * fallback, and migrate.ts's fallback — collapsed here so all of them stay
 * in sync if the local stack's host/port/credentials ever change. Reads
 * `QUESTLOG_PG_PORT` first (T-072) — no call-site changes needed.
 */
export function testDbUrl(dbname: string): string {
	return `postgresql://${USER}:${PASSWORD}@${HOST}:${resolvePort()}/${dbname}`;
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
