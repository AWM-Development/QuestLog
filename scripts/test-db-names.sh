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
TEST_DB_NAMES=("$TEST_DB_NAME_DEV" "$TEST_DB_NAME_CORE" "$TEST_DB_NAME_SERVER" "$TEST_DB_NAME_MCP")
# Test-tier-only names (excludes TEST_DB_NAME_DEV) — for CI provisioning and
# any other consumer that must never create/migrate the dev database.
TEST_DB_NAMES_CI=("$TEST_DB_NAME_CORE" "$TEST_DB_NAME_SERVER" "$TEST_DB_NAME_MCP")
