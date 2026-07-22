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
