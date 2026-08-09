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
	# Glob-matched, not exact — T-154 suffixes physical dbnames with a
	# worktree tag, so an exact match against the bare base name would
	# always miss inside a worktree.
	case "$dbname" in
	"$TEST_DB_NAME_OBSERVABILITY" | "$TEST_DB_NAME_OBSERVABILITY"__*) ;;
	*)
		local ext ext_ok
		for ext in $QUESTLOG_DB_REQUIRED_EXTENSIONS; do
			ext_ok=$("$run_query" "$dbname" "SELECT 1 FROM pg_extension WHERE extname='${ext}'")
			if [ "$ext_ok" != "1" ]; then
				echo "extension ${ext} missing on database ${dbname}"
				return
			fi
		done
		;;
	esac
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
	# OBSERVABILITY_DATABASE_URL, not just DATABASE_URL — found live during
	# T-154/T-131 verification: packages/observability/src/db/migrate.ts reads
	# `OBSERVABILITY_DATABASE_URL ?? DATABASE_URL ?? ...`, so once a worktree
	# actually has a `.env` (T-131), a real hosted OBSERVABILITY_DATABASE_URL
	# in that file silently outranks this test-only override and migrates the
	# real Neon observability branch instead of the local test database —
	# exactly the class of bug this whole redesign exists to kill. Harmless
	# for every other package's migrate command, which only ever reads
	# DATABASE_URL. See Docs/IMPLEMENTATION_NOTES.md § T-154.
	DATABASE_URL="$database_url" OBSERVABILITY_DATABASE_URL="$database_url" \
		eval "$(test_db_migrate_cmd "$dbname")"
}
