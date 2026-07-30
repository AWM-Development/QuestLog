# T-043 — Deduplicate the local test-database name list across CI and session-start.sh

Milestone ref: none — pipeline/tooling hygiene, same category as T-027/T-041,
not tied to a milestone checkbox.

Branch: chore/pipeline/t-043-dedupe-test-db-provisioning-list

Context files (load ONLY these):
  - .github/workflows/ci.yml (the "Create and migrate apps/mcp's test
    database" step, ~line 73-81, and its comment naming the duplication)
  - .github/workflows/e2e-release-check.yml (the equivalent e2e-tier step,
    ~line 73-82)
  - .claude/hooks/session-start.sh (the `for dbname in questlog questlog_test
    questlog_test_mcp` provisioning loop, ~line 107-119)
  - Docs/IMPLEMENTATION_NOTES.md § T-027 (why `questlog_test_mcp` exists as
    a separate database in the first place — the rationale this ticket
    isn't touching, only the copy-pasted list of names)

Mockup: none

Model: sonnet

Scope:
  All three files above independently hard-code the same local Postgres
  test-database names (`questlog`, `questlog_test`, `questlog_test_mcp`),
  each with a comment pointing at the other two ("DB list also duplicated
  in ci.yml and session-start.sh — update all three") instead of one of
  them actually being the source of truth. This is exactly the kind of
  three-way hand-synced duplication that silently drifts (add a fourth
  test database later — per T-042's own reasoning for *not* adding one —
  and it's easy to update two of the three and forget the third).

  Extract the list into one canonical source both CI workflows and the
  hook read from, instead of three independently-maintained literals.
  Suggested shape (adjust if a cleaner mechanism fits GitHub Actions'
  constraints better): a small shell-sourceable file, e.g.
  `scripts/test-db-names.sh`, defining the list once
  (`TEST_DB_NAMES=(questlog questlog_test questlog_test_mcp)` or
  equivalent); `session-start.sh` sources it directly; each CI workflow
  step sources it at the top of its `run:` block before provisioning.
  Whatever shape is chosen, the three call sites should end up reading
  from one file rather than each declaring the list itself, and the
  now-redundant "DB list also duplicated in..." comments should be
  replaced with a single comment pointing at the new canonical file.

Out of scope:
  - No change to *which* databases exist or *why* `questlog_test_mcp` is
    separate from `questlog_test` (T-026/T-027's decision) — this is a
    DRY fix on the list representation, not a re-litigation of the
    isolation strategy.
  - No change to the `testDbUrl()`-based literals inside
    `apps/server/vitest.config.ts` / `apps/mcp/vitest.config.ts` /
    `apps/mcp/vitest.e2e.config.ts` (soon `packages/mcp/vitest.config.ts`
    per T-042) — those are single call sites passing one name each, not
    copy-pasted lists, and are TypeScript, not shell — a different
    mechanism than the one being deduped here.
  - If T-042 has already merged by the time this runs, the file paths
    above will have shifted (`apps/mcp` → `apps/mcp-stdio`,
    `apps/server/src/mcp` → `packages/mcp`) — none of that affects this
    ticket's actual scope (the CI/session-start.sh files themselves don't
    move), just be aware the "apps/mcp's suite" wording in ci.yml's
    existing comment will read as slightly stale and can be tightened in
    passing.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary (this ticket doesn't touch app code, so this should be a
    no-op confirming nothing broke)
  - `grep -rn "questlog_test_mcp" .github/workflows/ session-start.sh`
    (adjust path to wherever the hook lives) shows the literal name
    appearing in exactly one canonical file, with the other call sites
    referencing it instead of repeating it
  - A CI run (or a local dry-run reproducing the same steps) still
    successfully provisions and migrates all three databases

Iteration cap: 3 distinct approaches on any single failure, then Blocked
  Protocol

Definition of done includes: `Docs/IMPLEMENTATION_NOTES.md` updated with a
  pointer to the new canonical file (so the next place someone thinks to
  add a fourth test database finds it immediately), a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written. No milestone checkbox to
  flip.
