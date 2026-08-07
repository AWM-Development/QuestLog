# T-145 — Directory/file organization audit & architecture documentation — Report

**Date:** 2026-08-07
**Run type:** Interactive session with Alex (per ticket's own "NOT ELIGIBLE FOR
AUTONOMOUS NIGHTLY EXECUTION" banner), on Sonnet.
**Goal:** human navigability of the repo — not a cosmetic pass, a deliberate
stop against AI-driven directory/file sprawl.

## Summary

Three real organizational findings, all fixed inline in this branch (no
backlog tickets filed — every finding was small enough to resolve directly,
unlike T-132's precedent where larger findings went to `backlog/`). One
already-ticketed finding (T-103) confirmed still correctly scoped, not
duplicated. `Docs/ARCHITECTURE.md` created as the primary deliverable. All
tests/typecheck/lint green across all 8 workspace packages after every
change.

---

## 1. Findings fixed inline

### `packages/core/src/ci/` → `packages/ci/`
CI-only guard logic (`gate-guard.ts`, `scope-guard.ts`, `guard-utils.ts` +
tests) was living inside a domain package (`packages/core`), alongside
`services/`, `db/`, `observability/` — invisible to anyone scanning for
"how does CI work here." Confirmed fully self-contained (zero dependency
on the rest of `@questlog/core` — only Node built-ins and its own relative
imports) before promoting, which made this a mechanical move rather than a
real refactor:
- New workspace package `packages/ci/` (`package.json`, `tsconfig.json`,
  `src/index.ts` barrel).
- `packages/core/package.json`: dropped the `ci-gate-guard`/`ci-scope-guard`
  scripts and the now-unused `tsx` devDependency.
- `scripts/ci-gate-guard.sh`, `scripts/ci-scope-guard.sh`: retargeted to
  `pnpm --filter @questlog/ci run gate-guard`/`scope-guard`.
- `.github/workflows/ci.yml`: updated the two comment blocks pointing at
  the old path.
- `packages/ci/src/gate-guard.test.ts`, `scope-guard.test.ts`: updated
  their example fixture path strings for consistency (not functionally
  required — those strings are arbitrary example content, not asserted
  against a real path).

### `packages/core/src/observability/` → `packages/core/src/usage-capture/`
The word "observability" was doing two different jobs at two different
structural levels: this module *captures* a session's token usage into a
`*.usage.json` artifact (a `Stop`-hook concern), while the sibling
`packages/observability/` package is the separate *storage* layer that
later ingests those artifacts into a durable store. Renamed the
capture-side module to describe what it actually does. Updated every live
reference:
- `packages/observability/src/{ingest.ts,ingest.test.ts,ingest-db.test.ts,cli.ts}`
  — import path for `UsageArtifact`.
- `apps/server/package.json`'s `capture-usage` script path.
- `.claude/hooks/stop-usage-capture.sh` comment.
- `.claude/rules/scripts.md`'s Shape-1 example.
- `Docs/tickets/EXECUTOR_ROUTINE.md` Step 6/7's `capture-usage` reference.
- `Docs/milestones/MILESTONES_V1_2_MCP.md` (M-OBS.7, not yet shipped).
- Open tickets `Docs/tickets/queue/T-051-cost-model-config.md`,
  `Docs/tickets/queue/T-118-llm-structured-extraction-client-pattern.md`,
  `Docs/tickets/backlog/T-109-runner-cost-adapter-interface.md` — all name
  the module in their own `Context files:`/`Scope:`, and would have broken
  against the new path once picked up.

Historical citations in `Docs/IMPLEMENTATION_NOTES.md`, `CHANGELOG.md`, and
`Docs/tickets/done/`/`reports/`/`archive/`/`gated/resolved/` were
deliberately left untouched — they're dated decision-log entries, accurate
as of when they were written, not living documentation. A new dated entry
was added to `IMPLEMENTATION_NOTES.md` (§ T-145) pointing this out
explicitly so a reader cross-referencing an older entry isn't confused by
the path mismatch.

### `Docs/AUDIT_2026-07.md` + `Docs/AUDIT_2026-07-M4.md` → `Docs/archive/`
Two one-time, pre-MCP-pivot snapshot audits were sitting at `Docs/` top
level alongside living docs (`PRD.md`, `DEVELOPMENT_GUIDE.md`,
`IMPLEMENTATION_NOTES.md`) with no structural signal that they were
historical, not current reference — despite `Docs/README.md` already
describing them in prose as "point-in-time... not living docs." Moved into
a new `Docs/archive/` directory (parallel to the existing
`Docs/milestones-archive/`). Updated every live cross-reference:
`Docs/DEVELOPMENT_GUIDE.md`, `Docs/IMPLEMENTATION_NOTES_ARCHIVE.md`,
`Docs/README.md` (also merged its "Audits" index section into "Historical"
and bumped its `Last Updated` date), `Docs/milestones/MILESTONES_V2.md`,
`Docs/milestones/MILESTONES_V1_MCP.md`. Historical citations in
`done/`/`reports/`/`archive/`/`gated/resolved/` ticket files were left
untouched for the same reason as above.

## 2. Already-ticketed finding — confirmed, not duplicated

`packages/mcp/src/server.test.ts` (2,916 lines — effectively the entire
`packages/mcp/src/tools/` directory's tests smashed into one file) is
already `T-103-split-mcp-server-test-file.md` in `Docs/tickets/queue/`.
Confirmed its scope still matches this audit's own oversized-file
heuristic (~500-line cap for test files); not re-solved here.

## 3. Reviewed and deliberately left alone

The file-count heuristic (15+ ungrouped files in a source directory)
technically flags these, but splitting them would cost more navigability
than it buys:

- `packages/core/src/services/` — 33 files, but 16 services in consistent
  `impl.ts`/`impl.test.ts` pairs, alphabetically flat and fast to scan.
- `packages/mcp/src/tools/` — 25 files (22 tools + `errors.ts`/`types.ts`
  + one shared `campaign-scoping.test.ts`), one file per MCP tool.
- `Docs/tickets/reports/` (100 files), `Docs/tickets/done/` (98 files) —
  append-only historical logs looked up by ticket number, not by browsing.
- `apps/web/src/features/*` — already subgrouped by
  `components/`/`hooks/`/`pages/`, and mostly the v2-frozen surfaces
  (`agent-chat`, `session-log`) `MILESTONES_V1_MCP.md`'s "Deferred to v2"
  list already calls out — not actively developed, so not a real
  navigability problem in practice.

Also ruled out as noise, not a finding: `apps/mcp/` (a bare, untracked
`node_modules/` directory left over locally from the old `apps/mcp` →
`apps/mcp-stdio` rename — not git-tracked, not a repo-organization
problem, T-126's domain if anything).

## 4. Primary deliverable

`Docs/ARCHITECTURE.md` — a repo-navigation guide first, system-architecture
reference second: a full repo map (top-level dirs, per-app/per-package role
table), placement rules for the recurring "where does new code go"
questions, this audit's own file-count/file-size heuristics written down as
an ongoing convention (§4 of that doc), a record of what this audit found
and fixed (§3, mirrors this report at a glance), and a short MCP
request-flow section for orientation. Linked from `AGENTS.md`'s pointer map
and `Docs/README.md`'s index (new "Architecture & Navigation" section).

## Verification

- `pnpm typecheck` / `pnpm lint` / `pnpm test` — all green across all 8
  workspace packages (`@questlog/ci`, `@questlog/core`, `@questlog/mcp`,
  `@questlog/mcp-stdio`, `@questlog/observability`, `@questlog/server`,
  `@questlog/shared`, `@questlog/web`) after both path renames.
- Re-applied this audit's own file-count/file-size heuristics to the
  post-fix tree (§3 above) — no ungrouped source directory at 15+ files
  and no un-filed oversized source file beyond the two already accounted
  for (T-103's `server.test.ts`; nothing new introduced by this audit's
  own edits).

## Operational note (unrelated to the audit's findings)

Mid-session, this primary checkout's working tree was found switched to
`develop` (HEAD at a `T-112` merge commit) without this session having
done so — most likely a nightly-executor run operating directly in the
primary checkout instead of a `tmp/worktrees/*` worktree, contrary to
`T-069`'s convention. No work was lost — this session's commits were
already on their own branch — but recorded in `IMPLEMENTATION_NOTES.md`
§ T-145 as a real instance of the class of hazard `T-069`/`T-127` exist to
prevent, worth a look if it recurs.

## Sign-off

Awaiting Alex's review before this branch merges.
