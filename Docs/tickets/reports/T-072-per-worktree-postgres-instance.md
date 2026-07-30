# T-072 — Per-worktree Postgres instance for concurrent local test runs

**Outcome:** shipped
**Branch:** chore/m-pipeline/t-072-per-worktree-postgres-instance
**Diff:** 9 files changed, +122/-5 lines

## What shipped

Each git worktree (T-069's `tmp/worktrees/T-###/` convention) now runs its own local Postgres instance on its own port instead of sharing the primary directory's fixed `:5433` — so two concurrent local sessions can no longer truncate or migrate each other's test data. `session-start.sh` provisions and migrates a worktree's own `docker compose` stack automatically; the primary working directory is untouched.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (642 passed)
```

(Also re-ran after rebasing onto latest `origin/develop` — identical result.)

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see Test evidence above (`scripts/run-tests-quiet.sh`, run both pre- and post-rebase).
- **Report states explicitly whether remote/sandboxed sessions can share one Postgres process** — resolved local-only, confirmed: `Docs/IMPLEMENTATION_NOTES.md` § T-072 "Step 0 resolved" — remote sandboxes are each a fresh, disposable workspace (`EXECUTOR_ROUTINE.md` Step 0), and `session-start.sh`'s remote branch provisions Postgres natively per-session, not via a shared `docker compose` daemon two sessions could both reach. No native-Postgres fallback was built, by design.
- **Two worktrees created per T-069's convention, each running `pnpm test` concurrently, resolve to two distinct Postgres ports/instances, confirmed by connecting to each directly and asserting the other's fixture data is absent** — verified empirically: created a real second worktree (`tmp/worktrees/T-999-verify/`, `git worktree add ... -b tmp/t-072-verify origin/develop`, since discarded), brought up both compose stacks (`T-072` → port 5693, project `questlog-t-072`; `T-999-verify` → port 5727, project `questlog-t-999-verify`), seeded a `verify_marker` table in `T-072`'s instance, and confirmed via `psql` against `T-999-verify`'s instance that `to_regclass('public.verify_marker')` returned null — the two instances are fully isolated (separate containers/volumes/networks, not just separate ports).
- **Primary working directory still connects on `:5433` with no config change required** — confirmed: `docker exec questlog-postgres-1 psql ... SELECT 1` and `pg_isready -h localhost -p 5433` both succeeded unchanged throughout, and `docker-compose.yml`'s `${QUESTLOG_PG_PORT:-5433}:5432` / `test-db-url.ts`'s fallback both preserve 5433 when the env var is unset (also covered by a new unit test).
- **`.claude/hooks/session-start.sh` provisions and migrates the session's own worktree-scoped instance, confirmed by running it inside a worktree and checking the resulting `DATABASE_URL`'s port matches that worktree's derived value** — confirmed via the same two-worktree run above: each worktree's derived `QUESTLOG_PG_PORT` (5693 / 5727) matched the port its `docker compose` stack actually listened on and the port used for the migration `DATABASE_URL`.
- **Report documents the exact reaping command and states whether it's wired to an existing worktree-removal step or still a gap** — `docker compose -p <project-name> down -v` (verified as part of the same manual test — both stacks were torn down this way at the end). Not wired to anything automated: `Docs/IMPLEMENTATION_NOTES.md` § T-069 already documents that worktrees themselves are never reaped, and this ticket doesn't change that — it's a manual step today, same as the worktree it belongs to.

## Reviewer verdict

PASS-WITH-NOTES. Verbatim:

> ## Correctness
> - `packages/core/src/db/test-db-url.ts:8-16` — `resolvePort()` reads `process.env.QUESTLOG_PG_PORT` fresh on every call (no module-level caching), so `vi.stubEnv` in `test-db-url.test.ts:24-45` works correctly and I confirmed the tests actually pass (`pnpm --filter @questlog/core test -- test-db-url` → 13/13 green).
> - `.claude/hooks/session-start.sh:52-55` — the worktree-detection `case` statement is correct as written; `set -euo pipefail` is set at the top of the script and `$CLAUDE_PROJECT_DIR` is already dereferenced unconditionally at line 5 (`cd "$CLAUDE_PROJECT_DIR"`), so an unset var would already abort before this new branch — not a new edge case introduced by this diff.
> - Verified the checksum math independently: `cksum` on `"T-072"` and `"T-999-verify"` reproduces the exact 5693/5727 port pair the IMPLEMENTATION_NOTES entry claims was empirically observed, so that verification claim is credible, not fabricated.
>
> ## Exit conditions
> - Tests/typecheck/lint: ran `pnpm typecheck` and `pnpm lint` myself — both green (FULL TURBO, all cached/passing).
> - Step 0 (remote/local collision question): explicitly resolved, local-only, both in `Docs/IMPLEMENTATION_NOTES.md` (new "T-072" section) and `CHANGELOG.md` — meets the exit condition.
> - Two distinct ports verified by direct connection, not just inspection: documented as done, with concrete port values that check out mathematically.
> - Primary working directory unchanged: `docker-compose.yml:9` (`${QUESTLOG_PG_PORT:-5433}:5432`) and `test-db-url.ts` fallback both preserve `5433` with no config needed — confirmed by the "falls back to 5433 when unset" test.
> - `session-start.sh` provisioning/migration against the worktree instance: present (`.claude/hooks/session-start.sh:56-77`), loops `TEST_DB_NAMES_CI` against the derived port.
> - Reaping documented, gap stated plainly: `Docs/IMPLEMENTATION_NOTES.md:811` states the exact command and that it's not wired to any automated step — meets the requirement.
>
> ## Scope
> - `Docs/tickets/queue/T-086-ci-pipeline-runtime-optimization.md` shows as deleted in the diff against `origin/develop`, but this is a stale-base artifact — the T-072 branch was cut from `4bab7e2` before T-086 was merged into `develop` (`c590f18`), not an intentional change by this ticket. Not a real finding against the diff's content, but the branch should rebase onto current `develop` before merge so the PR diff doesn't show a spurious deletion.
> - No other out-of-scope items touched: database names, CI workflows, T-069's worktree convention, and automated reaping are all left alone as required.
>
> ## Minor notes (not blocking)
> - `scripts/worktree-postgres-env.sh:27` — `COMPOSE_PROJECT_NAME="questlog-$(... | tr '[:upper:]' '[:lower:]')"` only lowercases; it doesn't strip characters outside Compose's allowed `[a-z0-9_-]` project-name charset. Harmless today since T-069's convention (`tmp/worktrees/T-###/`) only ever produces hyphen/digit basenames, but worth a one-line guard if the worktree-naming convention ever admits other characters.
> - `scripts/worktree-postgres-env.sh:2-14` — the header comment is close to restating the full IMPLEMENTATION_NOTES rationale rather than a one-line pointer, though it does end with an explicit `see Docs/IMPLEMENTATION_NOTES.md § T-072` pointer, which is what the comment-discipline rule asks for. Borderline but acceptable as written.
>
> No test theater found — the new `test-db-url.test.ts` cases assert exact connection-string values (not `toBeDefined()`), covering the override, unset, and invalid-value fallback paths.
>
> PASS-WITH-NOTES

The stale-base rebase note was addressed after review: the branch was rebased onto current `origin/develop` (past `T-086`, `T-071`, etc.) before this report was written, and the full test chain was re-run clean post-rebase (see Test evidence). The two minor notes were left as-is per the reviewer's own "not blocking" framing — `COMPOSE_PROJECT_NAME` charset stripping is speculative hardening against a naming convention T-069 doesn't currently allow, and the header comment was judged acceptable as written.

## Anything Alex must decide

- **Port-derivation collision risk is accepted, not eliminated.** `scripts/worktree-postgres-env.sh` hashes the worktree name into 1-of-500 port slots rather than doing a coordinated free-port scan across worktrees. Two worktrees could theoretically collide if their names hash to the same slot — judged acceptable given the small, short-lived set of concurrent local worktrees this repo actually runs, and because a real free-port scan would need its own cross-worktree coordination file to avoid a race between two sessions starting at once. Flagging this explicitly since it's a probabilistic guarantee, not an absolute one.
- **Worktree reaping (and therefore Postgres-stack reaping) is still an unticketed gap**, same as `Docs/IMPLEMENTATION_NOTES.md` § T-069 already flagged. This ticket documents the exact teardown command (`docker compose -p <project> down -v`) but doesn't wire it to anything, per its own out-of-scope list. Worth a follow-up ticket if orphaned worktree Postgres containers become a real disk/resource nuisance.
- No 🧠 gates were skipped in this ticket.
