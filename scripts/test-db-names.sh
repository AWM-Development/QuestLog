#!/bin/bash
# Canonical list of local Postgres test-database names. Sourced by
# ci.yml, e2e-release-check.yml, and .claude/hooks/session-start.sh so
# the names exist in exactly one place. Why questlog_test_mcp is a
# separate database from questlog_test: Docs/IMPLEMENTATION_NOTES.md § T-027.
TEST_DB_NAME_DEV=questlog
TEST_DB_NAME_UNIT=questlog_test
TEST_DB_NAME_MCP=questlog_test_mcp
TEST_DB_NAMES=("$TEST_DB_NAME_DEV" "$TEST_DB_NAME_UNIT" "$TEST_DB_NAME_MCP")
