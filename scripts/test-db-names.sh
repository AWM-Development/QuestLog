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
# dbname. Why: Docs/IMPLEMENTATION_NOTES.md § T-053.
declare -A TEST_DB_MIGRATE_CMD=(
	["$TEST_DB_NAME_DEV"]="pnpm --filter @questlog/server db:migrate"
	["$TEST_DB_NAME_CORE"]="pnpm --filter @questlog/server db:migrate"
	["$TEST_DB_NAME_SERVER"]="pnpm --filter @questlog/server db:migrate"
	["$TEST_DB_NAME_MCP"]="pnpm --filter @questlog/server db:migrate"
	["$TEST_DB_NAME_OBSERVABILITY"]="pnpm --filter @questlog/observability db:migrate"
)
