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
	# Queried against $TEST_DB_NAME_DEV rather than $dbname itself — pg_database
	# is a cluster-wide catalog, so any already-existing database's connection
	# works to look it up. $TEST_DB_NAME_DEV itself is guaranteed to exist by
	# the time either caller runs this, for two different reasons per branch:
	# locally, docker-compose.yml's POSTGRES_DB creates it at container start,
	# before session-start.sh ever runs; remotely, it's TEST_DB_NAMES's own
	# first entry (test-db-names.sh) and the remote branch's loops check
	# databases in that array's order, so it's already created/migrated
	# before any later database's readiness is ever checked.
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

# Creates $4 if it doesn't already exist, then applies its migration command
# (test_db_migrate_cmd, from test-db-names.sh). Shared by both branches the
# same way db_readiness_issue() is: $1/$2 abstract over *how* a database is
# checked/created (differing connection details per branch), not *whether*
# or *what* migrates it. Extracted alongside the existing "does this branch
# separately reimplement create-if-missing-then-migrate" duplication flagged
# in the same audit that added this function — see Docs/IMPLEMENTATION_NOTES.md § T-130.
#
# $1 = db_readiness_issue()'s own run_query runner (see above).
# $2 = the name of a function that creates a database given its name as $1,
#      using this branch's own connection details/owner clause.
# $3 = the DATABASE_URL to pass to this database's migrate command.
# $4 = the database name.
ensure_database_provisioned() {
	local run_query="$1" create_fn="$2" database_url="$3" dbname="$4"
	local db_exists
	db_exists=$("$run_query" "$TEST_DB_NAME_DEV" "SELECT 1 FROM pg_database WHERE datname='${dbname}'")
	if [ "$db_exists" != "1" ]; then
		"$create_fn" "$dbname"
	fi
	# Subshell so this never touches the calling session-start.sh process's
	# own OBSERVABILITY_DATABASE_URL — a legitimate later use of that var
	# elsewhere in the same hook run is untouched.
	#
	# NOTE this deliberately pre-SETS OBSERVABILITY_DATABASE_URL to
	# $database_url, rather than unsetting it (T-156's own ticket text
	# proposed `unset`, but that doesn't actually work — verified empirically
	# during implementation): packages/observability/src/db/migrate.ts's own
	# `dotenv.config({ path: "../../.env" })` call is what introduces the
	# ambient value into that child process, not anything this shell
	# exports — nothing upstream of that call ever exports
	# OBSERVABILITY_DATABASE_URL into the environment, so it's never
	# "already set" to `unset` away in the first place. `unset` leaves the
	# var genuinely absent, and dotenv fills in absent keys from the .env
	# file it loads — so an `unset` here is a no-op, and the real ambient
	# .env value still wins. dotenv's one actual guarantee — it never
	# overwrites an *already-set* var — is what this fix leans on instead:
	# pre-setting OBSERVABILITY_DATABASE_URL here, to the same value as
	# DATABASE_URL, makes dotenv's load of the ambient .env value a no-op,
	# and resolves migrate.ts's `OBSERVABILITY_DATABASE_URL ?? DATABASE_URL`
	# chain to the correct local URL directly (without ever needing to reach
	# the `?? DATABASE_URL` fallback). Setting it to empty instead of a real
	# URL would not fix this either: migrate.ts's `??` check treats an empty
	# string as defined, not nullish, so it would still short-circuit past
	# DATABASE_URL with an unusable empty connection string. Unconditional
	# (not branched on $dbname) to keep this function's contract uniform:
	# "$database_url is authoritative for this database" regardless of what
	# other DB-selecting env var an ambient .env happens to carry — the
	# non-observability test_db_migrate_cmd branch never reads
	# OBSERVABILITY_DATABASE_URL at all, so this is a harmless no-op there.
	# Why: Docs/tickets/done/T-156-observability-migrate-database-url-leak.md.
	(
		DATABASE_URL="$database_url" OBSERVABILITY_DATABASE_URL="$database_url" \
			eval "$(test_db_migrate_cmd "$dbname")"
	)
}
