# T-127 — Verification gate for the local worktree DB-provisioning path

Milestone ref: Docs/milestones/MILESTONES_V1_2_MCP.md M-EFFICIENCY.15

Complexity tier: S

Strategy-gate flag: yes — drafted directly by `/ungate` resolving G-035

Priority: P0

Branch: fix/m-efficiency/t-127-local-worktree-db-verification-gate

Context files (load ONLY these):
  - .claude/hooks/session-start.sh (both branches — lines 51-83 are the
    local/non-remote path this ticket hardens; lines 195-291 are the
    already-hardened remote path, specifically `db_readiness_issue()`
    at ~202-227 and the verification gate at ~257-286, which this
    ticket ports the same pattern from, not reinvents)
  - scripts/test-db-names.sh (`TEST_DB_NAMES_CI`, `TEST_DB_NAME_OBSERVABILITY`
    — the array this ticket's gate checks, and the one exemption
    `db_readiness_issue()` already carries for the observability DB's
    independent schema)
  - Docs/tickets/gated/resolved/G-035-prewarmed-sandbox-environment-investigation.md
    (this ticket's own origin — read its Resolution section for why the
    local path is now the priority-A execution surface instead of the
    remote cloud routine, and why this gate specifically is the thing
    that makes that trustworthy rather than hopeful)
  - Docs/IMPLEMENTATION_NOTES.md § T-098 (the remote path's own
    verification-gate implementation — same shape, same
    `db_readiness_issue()` function signature and reasoning, being
    ported to the other branch, not redesigned)

Scope:
  The local (non-remote, `CLAUDE_CODE_REMOTE != true`) branch of
  `session-start.sh` (T-072) provisions Postgres and loops
  `CREATE DATABASE`/`db:migrate` over `TEST_DB_NAMES_CI`, but — unlike
  the remote branch since T-098 — never confirms the end state actually
  landed. A silent gap here has already cost two real tickets real
  turns (T-064, T-092), both discovering a missing/unmigrated
  `questlog_test_observability` mid-session instead of at hook-exit.

  1. Extract `db_readiness_issue()` (or an equivalent) from the remote
     branch's own implementation into a shape both branches can call —
     same semantics: per-database existence check, required-extensions
     check (skipped for `questlog_test_observability`, matching the
     remote branch's own G-003-driven exemption), and an applied-
     migrations check via `drizzle.__drizzle_migrations`. Do not
     reimplement this logic a second time with new wording — the two
     branches' Postgres connection details differ (native `psql` as a
     superuser vs. `docker compose exec`/local `psql` against the
     compose-managed instance), so the extraction only needs to
     abstract over *how* a query is run, not *what* is checked.
  2. Add a verification step at the end of the local branch's DB
     loop (~line 80, before the existing `exit 0`) that runs this
     check against every `TEST_DB_NAMES_CI` entry and fails the hook
     loudly — a specific diagnostic naming the failed database and
     the unmet criterion, non-zero exit — instead of silently letting
     a broken worktree fall through to `exit 0` and surface as a
     confusing test failure minutes into real ticket work.
  3. Verify by deliberately reproducing T-098's own historical bug
     class in a throwaway worktree (e.g. manually drop
     `questlog_test_observability` after a normal provisioning run,
     then re-run the hook and confirm the gate catches it with a named
     diagnostic) rather than only reasoning about the code.

Out of scope:
  - Any change to the remote branch's own already-hardened gate — this
    ticket only ports the pattern to the other branch, it doesn't touch
    T-098's implementation.
  - The fast-path pre-check T-125 added to the remote branch (skip
    `db:migrate` when already-ready) — worth considering for the local
    branch too, but that's a separate optimization, not this ticket's
    correctness fix. File a follow-up if wanted, don't bundle it here.
  - Retiring T-072/T-087's per-worktree port-hashing/reaping machinery —
    a real future simplification (see G-035's Resolution), but
    contingent on the local path's reliability being proven over time
    with this gate in place first, not a precondition to shipping it.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `db_readiness_issue()` (or equivalent) is called from both branches
    of `session-start.sh`, confirmed via `grep`, not duplicated
  - a deliberately broken worktree (one `TEST_DB_NAMES_CI` database
    dropped or left unmigrated) causes the local branch to exit
    non-zero with a diagnostic naming the specific database and the
    specific unmet criterion — demonstrated live, output pasted in the
    ticket's report, not asserted
  - a normal, already-healthy worktree still exits 0 with no behavior
    change to the successful path

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped for M-EFFICIENCY.15 in
  `Docs/milestones/MILESTONES_V1_2_MCP.md`, `IMPLEMENTATION_NOTES.md`
  updated citing G-035's resolution as the reason this shipped, a
  `CHANGELOG.md` entry under `[Unreleased]`, morning report written.
