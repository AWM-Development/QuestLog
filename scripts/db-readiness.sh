#!/bin/bash
# Shared "is this database actually ready" check, used by both branches of
# .claude/hooks/session-start.sh's verification gate (and the remote
# branch's T-125 fast-path pre-check) so "ready" is defined in exactly one
# place instead of two independently-drifting copies. Why this file exists
# separately from session-start.sh itself: Docs/IMPLEMENTATION_NOTES.md § T-130
# — it also makes the check independently sourceable for live verification
# without paying the full hook's pnpm-install/docker-compose/migrate cost.
#
# Requires scripts/test-db-names.sh already sourced (TEST_DB_NAME_DEV,
# TEST_DB_NAME_OBSERVABILITY) and $CLAUDE_PROJECT_DIR set.

# Extension list needed by every consumer — parsed once, from migrate.ts's
# own REQUIRED_EXTENSIONS constant, so it can never drift from the app's
# actual source of truth.
QUESTLOG_DB_REQUIRED_EXTENSIONS=$(grep 'REQUIRED_EXTENSIONS' "$CLAUDE_PROJECT_DIR/packages/core/src/db/migrate.ts" \
	| head -1 | grep -oE '"[a-zA-Z_]+"' | tr -d '"')

# Returns (via stdout) the first unmet-readiness reason for a database, or
# nothing if it's fully ready — existence, required extensions (skipped for
# the observability db, which has its own independent schema with no
# vector/pg_trgm columns — G-003), and at least one applied migration.
#
# $1 = the name of a function that runs a scalar `-tAc` query against a
# given database and prints the result (or "none"/empty on error). The two
# branches' connection details differ (native superuser psql on the remote
# branch vs. docker-compose non-superuser psql locally), so this only
# abstracts over *how* a query is run, not *what* is checked — each caller
# defines its own runner and passes its name here rather than this file
# reimplementing the check twice with new wording.
# $2 = the database name to check.
db_readiness_issue() {
	local run_query="$1"
	local dbname="$2"
	local db_exists
	db_exists=$("$run_query" "$TEST_DB_NAME_DEV" "SELECT 1 FROM pg_database WHERE datname='${dbname}'")
	if [ "$db_exists" != "1" ]; then
		echo "database ${dbname} does not exist"
		return
	fi
	if [ "$dbname" != "$TEST_DB_NAME_OBSERVABILITY" ]; then
		local ext ext_ok
		for ext in $QUESTLOG_DB_REQUIRED_EXTENSIONS; do
			ext_ok=$("$run_query" "$dbname" "SELECT 1 FROM pg_extension WHERE extname='${ext}'")
			if [ "$ext_ok" != "1" ]; then
				echo "extension ${ext} missing on database ${dbname}"
				return
			fi
		done
	fi
	local migration_count
	migration_count=$("$run_query" "$dbname" "SELECT count(*) FROM drizzle.__drizzle_migrations")
	if ! [[ "$migration_count" =~ ^[0-9]+$ ]]; then
		migration_count=0
	fi
	if [ "$migration_count" -lt 1 ]; then
		echo "database ${dbname} has no applied migrations (drizzle.__drizzle_migrations empty or missing)"
		return
	fi
}
