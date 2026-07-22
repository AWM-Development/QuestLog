const HOST = "localhost";
const PORT = 5433;
const USER = "questlog";
const PASSWORD = "questlog";

/**
 * Builds the local docker-compose Postgres connection string for a given
 * database name. Single source of truth for the
 * `postgresql://questlog:questlog@localhost:5433/<dbname>` literal that used
 * to be hand-typed across both packages' vitest configs, test-helpers.ts's
 * fallback, and migrate.ts's fallback — collapsed here so all of them stay
 * in sync if the local stack's host/port/credentials ever change.
 */
export function testDbUrl(dbname: string): string {
	return `postgresql://${USER}:${PASSWORD}@${HOST}:${PORT}/${dbname}`;
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
 */
export function resolveLocalTestDbUrl(): string {
	const connectionString =
		process.env.DATABASE_URL ?? testDbUrl("questlog_test");
	assertLocalDatabaseUrl(connectionString);
	return connectionString;
}

/** Test fixture: syntactically valid, fake hosted-Neon connection string used across this module's callers' tests to exercise the reject path. */
export const FAKE_HOSTED_DB_URL =
	"postgresql://user:secretpw@ep-cool-glade-12345.us-east-2.aws.neon.tech/questlog?sslmode=require";
