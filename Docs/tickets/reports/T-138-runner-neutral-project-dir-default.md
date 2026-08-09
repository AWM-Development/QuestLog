# T-138 — Runner-neutral `CLAUDE_PROJECT_DIR` default

**Outcome:** won't-fix
**Branch:** n/a (never picked up for implementation)
**Complexity tier:** S
**Strategy-gate flag:** yes

## Resolution

Superseded by `T-154`, executed interactively the same day (2026-08-09).
T-154 deleted `scripts/worktree-postgres-env.sh` — the sole file this
ticket's Scope targeted — as part of replacing the checksum-derived-port
per-worktree Postgres design with a single shared instance and
worktree-suffixed database names derived from `process.cwd()`
(`packages/core/src/db/test-db-url.ts`'s `resolveWorktreeDbSuffix()`), not
`CLAUDE_PROJECT_DIR`. The silent-collision failure mode this ticket existed
to prevent (`WORKTREE_NAME` → `QUESTLOG_PG_PORT` derived from an unset-and-
defaulted `CLAUDE_PROJECT_DIR`, two sessions quietly sharing one Postgres) no
longer has a mechanism to trigger it — there's no more per-worktree port.
See the ticket file's own `## Resolution — WON'T FIX` section for the full
reasoning, and `Docs/IMPLEMENTATION_NOTES.md` § T-154.

## Anything Alex must decide

None. `.claude/hooks/session-start.sh` itself still requires
`CLAUDE_PROJECT_DIR` at its own top-level `cd`, which is a narrower,
lower-severity, genuinely-still-open gap (fails loud under `set -euo
pipefail`, doesn't silently collide) for a hypothetical non-Claude-Code
runner — worth its own ticket if a second runner ever actually needs it,
not reopened here.
