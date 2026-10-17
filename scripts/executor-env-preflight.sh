#!/bin/bash
# Executor environment preflight (T-192): fail fast and legibly on a bad
# cloud/scheduled environment BEFORE EXECUTOR_ROUTINE.md Step 1 claims
# anything. Prints one line — `ENV_OK` (exit 0) or
# `ENV_UNHEALTHY: <class>: <detail>` (exit 1) — class is one of
# node_modules | postgres | db_migrations | pgvector | git_remote | disk.
# Database-side checks reuse db_readiness_issue (scripts/db-readiness.sh),
# the same "ready" definition both SessionStart hooks' verification gates
# use. Why this exists: Docs/IMPLEMENTATION_NOTES.md § T-192.
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$PROJECT_DIR" || exit 1
# db-readiness.sh reads it to locate migrate.ts's REQUIRED_EXTENSIONS.
export CLAUDE_PROJECT_DIR="$PROJECT_DIR"

# Overridable so tests (and a future budget-tuned run) needn't touch the real disk.
MIN_FREE_MB="${PREFLIGHT_MIN_FREE_MB:-2048}"

source "$PROJECT_DIR/scripts/test-db-names.sh"
source "$PROJECT_DIR/scripts/db-readiness.sh"

unhealthy() {
	echo "ENV_UNHEALTHY: $1: $2"
	exit 1
}

# (a) dependencies
[ -d node_modules ] || unhealthy node_modules "node_modules/ missing in $PROJECT_DIR"
pnpm --version >/dev/null 2>&1 || unhealthy node_modules "pnpm is not runnable"

# (b)-(d) database stack. Remote sandboxes run one native Postgres on :5433
# (session-db-remote.sh); a local worktree runs its own docker-compose
# Postgres on a per-worktree port (session-db-local.sh) that only exists once
# Step 2 has created the worktree — nothing to check from the shared primary
# checkout, so the DB checks are skipped there rather than false-failing.
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
	port=5433
	db_names=("${TEST_DB_NAMES[@]}")
	preflight_psql_query() {
		sudo -u postgres psql -p "$port" -d "$1" -tAc "$2" 2>/dev/null || echo none
	}
else
	port="$(worktree_port "$PROJECT_DIR")"
	db_names=("${TEST_DB_NAMES_CI[@]}")
	preflight_psql_query() {
		PGPASSWORD=questlog psql -h localhost -p "$port" -U questlog -d "$1" -tAc "$2" 2>/dev/null || echo none
	}
fi

if [ -n "$port" ]; then
	pg_isready -h localhost -p "$port" -q || unhealthy postgres "no answer on localhost:${port}"

	for dbname in "${db_names[@]}"; do
		issue="$(db_readiness_issue preflight_psql_query "$dbname")"
		[ -z "$issue" ] || unhealthy db_migrations "$issue"
	done

	# Pin is the image tag in docker-compose.yml (ci.yml carries the same value).
	pinned="$(grep -oE 'pgvector/pgvector:[0-9]+\.[0-9]+\.[0-9]+' docker-compose.yml | head -1 | cut -d: -f2)"
	installed="$(preflight_psql_query "$TEST_DB_NAME_DEV" "SELECT default_version FROM pg_available_extensions WHERE name='vector'")"
	if ! [[ "$installed" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
		unhealthy pgvector "could not read installed pgvector version (got '${installed}')"
	fi
	lowest="$(printf '%s\n%s\n' "$pinned" "$installed" | sort -V | head -1)"
	[ "$lowest" = "$pinned" ] || unhealthy pgvector "installed ${installed} is older than the ${pinned} pinned in docker-compose.yml"
else
	echo "preflight: shared primary checkout, not a worktree — database checks deferred to Step 2's per-worktree bootstrap" >&2
fi

# (e) git remote
timeout 30 git ls-remote origin develop >/dev/null 2>&1 || unhealthy git_remote "git ls-remote origin develop failed"

# (f) disk
free_mb="$(df -Pk "$PROJECT_DIR" | awk 'NR==2 {print int($4/1024)}')"
[ "${free_mb:-0}" -ge "$MIN_FREE_MB" ] || unhealthy disk "${free_mb}MB free, floor is ${MIN_FREE_MB}MB"

echo "ENV_OK"
