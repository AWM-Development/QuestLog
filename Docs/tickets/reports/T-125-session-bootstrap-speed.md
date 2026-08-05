# T-125 — Cut session bootstrap wall-clock: base image, warm caches, fast-path migrate check

**Outcome:** shipped
**Branch:** feat/m-efficiency/t-125-session-bootstrap-speed
**Diff:** 6 files changed, +264/-37 lines (`.claude/hooks/session-start.sh`, `CHANGELOG.md`, `Docs/IMPLEMENTATION_NOTES.md`, `Docs/milestones/MILESTONES_V1_2_MCP.md`, `infra/README.md` new, `infra/session-bootstrap.Dockerfile` new)
**Complexity tier:** M
**Strategy-gate flag:** no

## What shipped

1. `infra/session-bootstrap.Dockerfile` — a base image build script that pre-installs `postgresql-16-pgvector` via the PGDG channel, so `.claude/hooks/session-start.sh`'s existing `dpkg -s postgresql-16-pgvector` check (line 129) can skip its own apt-get/PGDG block entirely once the Claude Code Remote environment is pointed at it. `infra/README.md` documents the build/publish/wire-up steps and the exact image tag to use.
2. `infra/README.md` also documents, as a verified background fact, why `pnpm install` already completes sub-second on a warm session (pnpm's content-addressable store + `node_modules` short-circuit), with a regression note for future base-image changes.
3. `session-start.sh`'s remote-sandbox branch now fast-paths its per-package `db:migrate` loop: a shared `db_readiness_issue()` helper (also used by the existing T-098 verification gate, replacing that gate's own duplicated inline checks) determines up front whether every `TEST_DB_NAMES` database already satisfies the gate's criteria; if so, the loop is skipped with a logged reason. A genuinely fresh or partially-migrated database still runs the full unchanged loop.

## Test evidence

```
$ export CLAUDE_PROJECT_DIR="$(pwd)"
$ source scripts/worktree-postgres-env.sh
$ bash scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (724 passed)
```

`bash -n .claude/hooks/session-start.sh` → syntax OK.

Real `docker build` of `infra/session-bootstrap.Dockerfile` (this local machine's Docker Desktop reaches Docker Hub/apt.postgresql.org fine — unlike the constrained remote-executor sandbox `EXECUTOR_ROUTINE.md`'s "Known sandbox constraint" note describes):

```
$ docker build -f infra/session-bootstrap.Dockerfile -t questlog-session-bootstrap:t-125-verify .
...
#5 28.85 Setting up postgresql-16-pgvector (0.8.6-1.pgdg24.04+1) ...
#6 writing image sha256:ef735244ae72eb1421e1e4fc37af5d755945c75dd7b39f41d5b2c5fa58fd27d5
#6 naming to docker.io/library/questlog-session-bootstrap:t-125-verify done

$ docker run --rm questlog-session-bootstrap:t-125-verify dpkg -s postgresql-16-pgvector
Package: postgresql-16-pgvector
Status: install ok installed
Version: 0.8.6-1.pgdg24.04+1

$ docker run --rm questlog-session-bootstrap:t-125-verify bash -c 'test -f /etc/apt/sources.list.d/pgdg.list && echo LEFTOVER || echo "clean, no leftover pgdg.list"'
clean, no leftover pgdg.list
```

Fast-path / verification-gate logic, exercised end-to-end inside a real Postgres running in the built image (byte-identical fragment of `session-start.sh`, `sed`-extracted, not retyped — see `Docs/IMPLEMENTATION_NOTES.md` § T-125 for the harness setup):

```
--- READY CASE (expect fast-path skip) ---
session-start.sh: fast-path — all 5 database(s) already satisfy the verification gate's criteria, skipping per-package db:migrate loop
session-start.sh: remote sandbox DB provisioned OK — pgvector 0.8.6, 5 database(s) migrated

--- NOT-READY CASE (one db's migrations deliberately deleted) ---
session-start.sh: remote sandbox DB provisioned OK — pgvector 0.8.6, 5 database(s) migrated
--- migrate calls log ---
CALLED:questlog
CALLED:questlog_test_core
CALLED:questlog_test_server
CALLED:questlog_test_mcp
CALLED:questlog_test_observability
```

(No fast-path message in the not-ready case — confirms the fall-through; the full per-package loop ran for all five databases, confirmed by the stubbed `test_db_migrate_cmd`'s own call log, since the minimal container has no `pnpm`/Node to run a real `db:migrate`. The gate still ended in a pass afterward.)

## Exit condition check

- **all tests green, typecheck clean, lint clean** — met, see Test evidence above (724 passed, 0 lint warnings, typecheck clean).
- **fast-path skips per-package `db:migrate` calls, logged, on an already-satisfying database, loop wall-clock lower** — met. Ready-case run: zero `psql`/migrate calls, one log line, ~0.8s total for the whole fragment. Not-ready case: five migrate calls. The savings scale with however many packages `TEST_DB_NAMES` has (currently 5) — each avoided call is a full `pnpm --filter ... db:migrate` invocation in the real hook, not just the stubbed no-op used in this harness.
- **a database missing a required migration still runs the full loop and ends in a passing gate** — met, see the not-ready case above: all five `db:migrate` calls fired, gate passed afterward.
- **Dockerfile/build script under `infra/`, builds successfully, resulting image has `postgresql-16-pgvector` installed and importable via `dpkg -s`** — met, see Test evidence above (`Version: 0.8.6-1.pgdg24.04+1`, `Status: install ok installed`).

## Reviewer verdict

PASS-WITH-NOTES. Verbatim:

> **What I checked:** `.claude/hooks/session-start.sh` diff line-by-line: the `db_readiness_issue()` extraction correctly consolidates the existence/extension/migration checks. The fast-path pre-check loop (`all_databases_ready`) correctly breaks on the *first* unmet criterion and falls through unchanged to the original per-package loop; the verification gate at the bottom still runs unconditionally afterward regardless of which path fired, exactly matching the ticket's "the fast-path never masks a genuinely unmigrated database" requirement. `bash -n` syntax check passes. Lines 1-83 (local/non-remote branch) are byte-identical to `origin/develop` — confirmed via diff, no stray edits there.
> `infra/session-bootstrap.Dockerfile` and `infra/README.md`: the write-up is honest — explicitly labels the "Wiring it in" section as Alex-only/not attempted, states real build/verification evidence will be pasted in the (not-yet-created) ticket report, and doesn't claim the CCR environment was actually reconfigured. This matches the ticket's mixed-autonomy banner precisely.
> Out-of-scope boundaries: no changes to `ci.yml`, no changes to the local branch of `session-start.sh`, no develop-sync/develop-ff guard changes, no actual environment-configuration change attempted.
> `CHANGELOG.md`, `Docs/IMPLEMENTATION_NOTES.md`, and the `MILESTONES_V1_2_MCP.md` checkbox are already updated in this diff — ahead of the routine's normal Step 7 timing, but that's not itself a violation, and the report file not yet existing is expected.
>
> **Minor notes (not blocking):**
> - `infra/session-bootstrap.Dockerfile:1-9` and `:41-45` both spell out the same rationale in full prose, within the same file. Minor duplication — could collapse the footer comment to a one-line pointer at the header. Very small nit in a doc-heavy infra file, not sprawl in application logic.
> - The unrelated `Docs/tickets/queue/T-083-create-entity-lore-seeding.md` backlog→queue move is present in this branch's history but predates the T-125 pickup commit and is normal ticket-queue bookkeeping (`EXECUTOR_ROUTINE.md` Step 2's backlog-promotion step) from before the branch was cut, not scope creep introduced by this ticket's work.
>
> No functionality gaps, no test theater, no scope-creep beyond what's described above.
>
> PASS-WITH-NOTES

Left the minor Dockerfile-comment-duplication note as-is per the routine (PASS-WITH-NOTES proceeds directly to wrap-up, no remediation pass required) — low value to touch given it's two short prose comments in one small infra file, not duplicated logic.

## Efficiency notes

Ran tight relative to its Complexity tier M rating. The three scope items were independently verifiable (Docker build, a standalone bash-fragment harness, and a documentation write-up grounded in this session's own observed timing), so no back-and-forth was needed once each was worked out. The main non-obvious step was realizing this local machine's Docker Desktop could actually reach Docker Hub/PGDG (unlike the constrained remote-executor sandbox `EXECUTOR_ROUTINE.md` warns about) — that turned "write a Dockerfile and hope" into a real build-and-verify, which is why the report can cite concrete `dpkg -s` output instead of reasoning alone. The bash-fragment test harness (extracting the literal changed lines via `sed`, seeding a real Postgres inside the built image, stubbing only the one external dependency — `pnpm`/`test_db_migrate_cmd` — that a minimal Ubuntu+Postgres container can't run) took the most iteration, since the first stub attempt was silently overwritten by the fragment's own re-source of `test-db-names.sh` before the fix (moving the stub into the sourced file itself) worked.

**Retry log:** 1 retry: 1 `environment_setup` (the not-ready-case harness's `test_db_migrate_cmd` stub was overwritten because the sourced fragment re-sources `scripts/test-db-names.sh` itself; fixed by baking the stub into a copy of that file instead of redefining the function after sourcing it — a test-harness wiring issue, not a bug in the shipped `session-start.sh` logic itself).

## Anything Alex must decide

- No 🧠 gate was surfaced by this ticket at ship time; one was filed afterward — see the correction below.

## Correction (2026-08-04, via `/morning-review` + G-034)

The original report above claimed a pointable base-image setting existed on the Claude Code Remote platform and left "wiring it in" as an Alex-only next step. That assumption was never actually verified, and it was wrong. `/morning-review` review of this PR surfaced the gap; `G-034` (`Docs/tickets/gated/resolved/G-034-ccr-base-image-configuration-mechanism.md`) investigated it directly with Alex and found:

- **No custom-base-image mechanism exists on this platform at all** — the actual environment-configuration UI only exposes Name, Network access, Environment variables, and a Setup script (bash). `infra/session-bootstrap.Dockerfile` had nowhere to plug in and has been removed.
- **A session's own "Setup script" doesn't persist state across sessions either** — confirmed empirically by running the exact PGDG install commands in two back-to-back sessions against the same test environment; both did a full fresh install, no caching.
- **The real, more important finding**: that same investigation showed the sandbox's egress proxy hard-blocks the CONNECT tunnel to `apt.postgresql.org` (403, confirmed via direct `curl` testing) as a matter of policy. This means `session-start.sh`'s PGDG-first branch had never actually been reaching PGDG in this sandbox class — every remote session was silently falling back to Ubuntu's `postgresql-16-pgvector 0.6.0`, three minors behind the 0.8.x `hnsw.iterative_scan` needs (§ T-016). This was a live correctness gap, not a hypothetical.

**Fix applied on this same branch**: `session-start.sh` now builds pgvector from source, pinned to `0.8.5` (matching `docker-compose.yml`/`ci.yml`'s `pgvector/pgvector:0.8.5-pg16` exactly), using GitHub (confirmed reachable through the same proxy) instead of PGDG. Verified end-to-end with a real from-scratch Docker rebuild:

```
$ docker build -t g034-pgvector-source-verify .   # Ubuntu 24.04 + postgresql-16, no PGDG
$ docker run --rm g034-pgvector-source-verify /fragment.sh
--- before ---
not present (expected, fresh image)
--- after ---
PASS: /usr/share/postgresql/16/extension/vector--0.8.5.sql exists
--- second run (idempotency / already-built skip) ---
SKIP: already built, no rebuild needed
```

First pass used a plain `make && make install` and reproduced a real bug: `CREATE EXTENSION vector;` segfaulted Postgres outright —

```
2026-08-05 00:31:06.536 UTC [789] LOG:  server process (PID 812) was terminated by signal 11: Segmentation fault
2026-08-05 00:31:06.536 UTC [789] DETAIL:  Failed process was running: CREATE EXTENSION vector;
```

— traced to pgvector's default `-march=native` build flag combined with `-flto=auto`. Rebuilding with `OPTFLAGS=""` (pgvector's own documented mitigation) fixed it, confirmed by re-running end-to-end:

```
$ docker run --rm g034-pgvector-source-verify.../fragment2.sh   # OPTFLAGS="" build
PASS: build/install done, /usr/share/postgresql/16/extension/vector--0.8.5.sql exists: yes
CREATE EXTENSION
 extname | extversion
---------+------------
 vector  | 0.8.5
(1 row)
```

`bash -n .claude/hooks/session-start.sh` → syntax OK after the edit.

The `infra/` directory (Dockerfile + README) has been removed — it documented a mechanism that doesn't exist on this platform. The `db:migrate` fast-path and the pnpm warm-cache finding from the original ticket are unaffected and remain shipped as originally verified.
