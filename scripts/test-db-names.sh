#!/bin/bash
# Canonical list of local Postgres test-database names. Sourced by
# ci.yml, e2e-release-check.yml, and .claude/hooks/session-start.sh so
# the names exist in exactly one place. Every DB-touching package gets its
# own physical database — no shared `dependsOn` ordering stands in for
# isolation. Why: Docs/IMPLEMENTATION_NOTES.md § T-027, § G-008.
TEST_DB_NAME_DEV=questlog
TEST_DB_NAME_CORE=questlog_test_core
TEST_DB_NAME_SERVER=questlog_test_server
TEST_DB_NAME_MCP=questlog_test_mcp
TEST_DB_NAME_OBSERVABILITY=questlog_test_observability
TEST_DB_NAMES=("$TEST_DB_NAME_DEV" "$TEST_DB_NAME_CORE" "$TEST_DB_NAME_SERVER" "$TEST_DB_NAME_MCP" "$TEST_DB_NAME_OBSERVABILITY")
# Test-tier-only names (excludes TEST_DB_NAME_DEV) — for CI provisioning and
# any other consumer that must never create/migrate the dev database.
TEST_DB_NAMES_CI=("$TEST_DB_NAME_CORE" "$TEST_DB_NAME_SERVER" "$TEST_DB_NAME_MCP" "$TEST_DB_NAME_OBSERVABILITY")

# Maps each test-tier dbname to the migrate command that applies its schema.
# Most packages share packages/core's migrations via @questlog/server's
# db:migrate; packages/observability's schema is independent (G-003) and
# migrates via its own package script instead. Consumed by ci.yml and
# session-start.sh so neither hardcodes a single migrate command for every
# dbname. A function, not an associative array (`declare -A`) — macOS ships
# bash 3.2 by default (no associative-array support), and session-start.sh
# must run under that. Why: Docs/IMPLEMENTATION_NOTES.md § T-053.
test_db_migrate_cmd() {
	case "$1" in
		"$TEST_DB_NAME_OBSERVABILITY")
			echo "pnpm --filter @questlog/observability db:migrate"
			;;
		*)
			echo "pnpm --filter @questlog/server db:migrate"
			;;
	esac
}

# Template-database names for CI's clone-instead-of-replay provisioning
# (T-086). One template per distinct schema family, not one for all of
# TEST_DB_NAMES_CI — packages/observability's schema is independent
# (G-003, see test_db_migrate_cmd above), so cloning it from a
# core-schema template (or vice versa) would produce the wrong schema.
# Why: Docs/IMPLEMENTATION_NOTES.md § T-086.
TEST_DB_TEMPLATE_CORE=questlog_test_template_core
TEST_DB_TEMPLATE_OBSERVABILITY=questlog_test_template_observability
TEST_DB_TEMPLATES=("$TEST_DB_TEMPLATE_CORE" "$TEST_DB_TEMPLATE_OBSERVABILITY")

# Maps each test-tier dbname to the template it clones from — mirrors
# test_db_migrate_cmd's own case split (same schema-family boundary) rather
# than duplicating that logic with a second, independently-maintained switch.
test_db_template_name() {
	case "$1" in
		"$TEST_DB_NAME_OBSERVABILITY")
			echo "$TEST_DB_TEMPLATE_OBSERVABILITY"
			;;
		*)
			echo "$TEST_DB_TEMPLATE_CORE"
			;;
	esac
}
