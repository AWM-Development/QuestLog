# T-027 — Audit and rationalize test-DB infrastructure sprawl

Milestone ref: M-MCP.2 (`Docs/MILESTONES_V1_MCP.md`) — test-infra follow-up
from T-026's post-merge review; not itself a milestone task (test
infrastructure only)

Branch: feat/m-mcp/t-027-test-infra-sprawl-cleanup

Context files (load ONLY these):
  - apps/mcp/vitest.config.ts
  - apps/server/vitest.config.ts
  - apps/mcp/vitest.e2e.config.ts
  - apps/server/vitest.e2e.config.ts
  - apps/server/src/db/test-helpers.ts
  - apps/server/src/db/migrate.ts
  - apps/server/src/db/global-setup.ts
  - .claude/hooks/session-start.sh
  - .github/workflows/ci.yml
  - .github/workflows/e2e-release-check.yml
  - turbo.json
  - Docs/IMPLEMENTATION_NOTES.md (search "T-018" and "T-026" for the existing
    mechanics writeup this ticket extends)
  - Docs/tickets/reports/T-026-mcp-test-db-isolation.md (what T-026 already
    fixed, and its own "Anything Alex must decide" caveats)

Mockup: none

Model: sonnet

Scope:
  T-026 gave `apps/mcp`'s default test tier its own database
  (`questlog_test_mcp`) to stop it colliding with `apps/server`'s concurrent
  suite. A post-merge review of that ticket found the fix is incomplete and
  the surrounding config has accumulated duplication that makes gaps like
  this easy to introduce silently. Audit and fix, without changing what any
  test actually verifies:

  1. **Close the same race in the e2e tier.** `apps/mcp/vitest.e2e.config.ts`
     still points `DATABASE_URL` at the shared `questlog_test` (never
     updated by T-026, which only touched the default-tier config).
     `pnpm turbo test:e2e` runs `apps/server/src/services/search.e2e.test.ts`
     and `apps/mcp/src/query-lore.e2e.test.ts` concurrently (no `dependsOn`
     between them, same as the default `test` task) against that same
     database — the identical class of race T-026 fixed, still live here.
     Point `apps/mcp/vitest.e2e.config.ts` at `questlog_test_mcp` instead,
     and add the matching provisioning/migration step to
     `.github/workflows/e2e-release-check.yml` (mirror the step T-026 added
     to `ci.yml`).

  2. **Collapse the duplicated connection-string literal.** The string
     `postgresql://questlog:questlog@localhost:5433/<dbname>` is currently
     hand-typed in at least 6 TypeScript locations (both packages' default
     and e2e vitest configs, `test-helpers.ts`'s fallback, `migrate.ts`'s
     fallback) plus the CI YAML files. Extract one shared module (e.g.
     `apps/server/src/db/test-db-url.ts`, exporting something like
     `testDbUrl(dbname: string)` built from host/port/user/password
     constants) and have every TS call site above import it instead of
     retyping the literal. Bash/YAML can't import a TS module — leave those
     as literals, but see item 3.

  3. **Prevent the db-name list from silently drifting.** The set of
     provisioned test databases (`questlog`, `questlog_test`,
     `questlog_test_mcp`) is independently listed in
     `.claude/hooks/session-start.sh`'s `for dbname in ...` loop,
     `.github/workflows/ci.yml`'s steps, and (after item 1)
     `.github/workflows/e2e-release-check.yml`'s steps, with nothing tying
     them together. Add a short comment at each of the three sites naming
     the other two, so adding a fourth database in the future is a
     find-and-check-three-places operation instead of a silent miss in one.

  4. **Document the isolation model as a deliberate decision.** Add a note
     in `Docs/IMPLEMENTATION_NOTES.md` (new entry, don't edit the existing
     T-018/T-026 history) explaining, in one place: (a) why `turbo.json` has
     no `dependsOn` between the `test`/`test:e2e` tasks of packages that
     touch a database — isolation comes from separate physical databases,
     not execution ordering — and (b) why test isolation within a single
     package's suite is truncate-once-per-run
     (`global-setup.ts`) + manual per-test scoping (a `campaignId` each test
     creates and cleans up itself) rather than a transaction-per-test
     rollback pattern, referencing `test-helpers.ts`'s existing docstring
     on `createTestDb`/`deleteCampaignTree` for the mechanics. Goal: a
     future contributor reads one paragraph and understands this is a
     considered tradeoff, not an oversight.

  5. **Document the cross-app import as intentional, not a boundary
     violation — no restructuring.** `apps/mcp/vitest.config.ts` and
     `apps/mcp/vitest.e2e.config.ts` both load `globalSetup` from
     `apps/server/src/db/global-setup.ts` via a relative path reaching
     across the app boundary. This was investigated and resolved
     (2026-07-20) as part of planning this ticket — it does **not** need
     further investigation, just documentation:
       - It's consistent with `apps/mcp`'s established architecture, not an
         exception: `apps/mcp/tsconfig.json` already declares a first-class
         `@questlog/server/*` path alias (backed by a TS project reference
         and a `workspace:*` package.json dependency) that every tool file
         in `apps/mcp/src` uses to import `apps/server`'s services
         directly, per `.claude/rules/mcp.md`'s "sibling app, not a
         rewrite" design. Moving `global-setup.ts` to `packages/shared`
         would be the actual violation — `packages/shared` is
         types/constants/validators only (CLAUDE.md), and
         `global-setup.ts`'s truncation logic is tied directly to
         `apps/server`'s Drizzle schema, so relocating it would move the
         coupling, not remove it. **Do not move this file.**
       - Separately confirmed empirically: `globalSetup`'s path does **not**
         resolve through the `resolve.alias` config defined in the same
         file — Vitest's global-setup loader bypasses Vite's resolver
         entirely (swapping the relative path for the
         `@questlog/server/db/global-setup.ts` alias throws
         `ERR_MODULE_NOT_FOUND`). So the raw relative path is required, not
         a leftover inconsistency with the alias used elsewhere in the same
         file. **Do not change this to the alias form — it will break.**
       - Add a short comment directly above each `globalSetup: [...]` line
         (both configs) stating both facts above, so neither looks like
         unaddressed debt to a future reader.

Out of scope:
  - No change to the transaction-vs-truncate isolation strategy itself
    (item 4 documents the existing tradeoff; it doesn't relitigate it).
  - No change to `turbo.json`'s task graph — `test`/`test:e2e` tasks stay
    concurrent and unserialized, exactly as today (same explicit carve-out
    T-026 made).
  - No new infrastructure (testcontainers, ephemeral per-run databases,
    Docker init-script based provisioning) — this is a rationalization of
    what exists, not a redesign.
  - No production or dev (non-test) database changes.
  - No change to what any existing test asserts, or to test count/coverage
    — every currently-passing test must still pass, testing the same thing,
    after this ticket. This ticket changes how config values are obtained,
    not what's being verified.
  - No move of `apps/server/src/db/global-setup.ts` to `packages/shared` or
    anywhere else, and no change of its `globalSetup` reference to the
    `@questlog/server` alias form — both investigated and rejected per item
    5; comment-only for that item.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary
  - test count unchanged: paste the `Tests`/`Test Files` counts from both
    the pre-ticket baseline (`git stash` or a clean `develop` checkout) and
    the post-ticket run, side by side, showing they match
  - `grep -rn "postgresql://questlog:questlog@localhost:5433" apps/ --include="*.ts"`
    returns matches only inside the new shared module (item 2) — zero
    remaining hand-typed literals in any `.ts` file
  - `apps/mcp/vitest.e2e.config.ts`'s `DATABASE_URL` no longer equals
    `apps/server`'s (`questlog_test`); `e2e-release-check.yml` provisions
    and migrates `questlog_test_mcp`; a forced `pnpm turbo test:e2e` run
    with both packages' e2e suites executing concurrently is green with no
    FK-violation/interference (or, if the e2e tier can't be run live from
    the execution sandbox — it needs real `VOYAGE_API_KEY`/
    `ANTHROPIC_API_KEY` secrets — the config + workflow diff plus a note
    explaining why, same fallback precedent as T-026 used for its own CI
    verification)
  - `Docs/IMPLEMENTATION_NOTES.md` contains the new isolation-model note
    from item 4
  - both `apps/mcp` vitest configs' `globalSetup` lines have the explanatory
    comment from item 5

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable (not a milestone task, same precedent as T-009/T-026),
  IMPLEMENTATION_NOTES.md updated per Scope item 4, a CHANGELOG.md entry
  under [Unreleased], morning report written.
