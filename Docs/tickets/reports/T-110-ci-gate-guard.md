# T-110 — CI gate guard: fail a PR whose ticket carries an unresolved `Gated on:`/unmet `Blocked on:`

**Outcome:** shipped
**Branch:** feat/m-pipeline/t-110-ci-gate-guard
**Diff:** 8 files changed, +372/-3 lines
**Complexity tier:** M
**Strategy-gate flag:** yes

## What shipped

A new CI job, "Gate Guard," fails any PR that adds or modifies a ticket file under `Docs/tickets/{queue,backlog,in-progress,done}/` carrying an unresolved `Gated on: G-###` (the gate still open under `Docs/tickets/gated/`) or a `Blocked on: T-###` whose id has no file under `Docs/tickets/done/` yet. The checkable logic lives in `packages/core/src/ci/gate-guard.ts` (dual-mode script, unit-tested via an injected-deps entry function per `.claude/rules/scripts.md`), invoked by the reusable `scripts/ci-gate-guard.sh` wrapper — the same entry point T-115's pre-flight wiring will call.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (731 passed)
```

`packages/core` unit suite for the new module specifically:

```
 RUN  v3.2.4 /Users/.../packages/core

 ✓ |core| src/ci/gate-guard.test.ts (12 tests) 3ms

 Test Files  1 passed (1)
      Tests  12 passed (12)
```

actionlint (workflow self-validation, run locally the same way the `actionlint` CI job does):

```
$ ./actionlint -color
(no output — exit 0)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see full-suite output above (731 tests, all packages).
- **Fixture pass: synthetic PR diff introducing a ticket with an unresolved `Gated on:` fails the check; the same ticket with the `Gated on:` line removed passes** — `gate-guard.test.ts:51-66` (fails) and `:68-81` (passes once the line is dropped, simulating a promotion). Also verified end-to-end against real git history: created a two-commit synthetic diff on this branch (fixture ticket with `Gated on: G-013`, a real still-open gate) and ran `scripts/ci-gate-guard.sh HEAD~1` directly — exited 1 with `❌ ...carries an unresolved Gated on: G-013 ... — only /ungate may clear this`. Fixture commits were then reset out before the real feature work continued.
- **Synthetic PR diff with `Blocked on: T-999` (no such ticket in `done/`) fails; naming a real `done/` ticket id passes** — `gate-guard.test.ts:83-97` (fails) and `:99-113` (passes, using `T-080`, a real merged ticket). Also verified end-to-end: a synthetic `Blocked on: T-999999` fixture committed to this branch and checked with `scripts/ci-gate-guard.sh HEAD~N` exited 1 with the expected message; reset out afterward the same way.
- **New job added to branch protection's required status checks on `develop`** — **not completable from this session.** `gh api repos/AWM-Development/QuestLog/branches/develop/protection` returns `403 Upgrade to GitHub Pro or make this repository public to enable this feature` — an account/repo-tier limitation, not a diff gap. See "Anything Alex must decide" below.

## Reviewer verdict

**PASS.** Verbatim from the `reviewer` subagent:

> Diff-scoped, not repo-wide... matching Scope's "a ticket file being added or modified by this PR, not every ticket file in the repo." (a)/(b) hard-fail split and stale-reference warning match Scope's three-way split exactly. Promotion exemption is satisfied structurally... Test at `gate-guard.test.ts:68-81` exercises exactly this case. Script is dual-mode per `.claude/rules/scripts.md` Shape 1... correct shape. CI job mirrors the `doc-sync`/`migration-guard`/`mockup-guard` shape... reasonable, not scope creep. `tsx` pinned to the same `^4.19.3` already used elsewhere — no version drift introduced. actionlint YAML-quoting issue was caught and fixed in-branch.
>
> Test quality: all 12 tests... are real, not theater — each of the exit condition's four named cases has a directly corresponding test... plus warning-not-fail, non-ticket-file-ignored, and deleted-file-skip edge cases. Ran locally: 12/12 pass. Typecheck and lint clean.
>
> Out of scope respected: no touching of T-111/112/113/114/115 logic; T-115's pre-flight wiring explicitly left undone, only the reusable script built.
>
> No functionality gaps, no scope creep, no test theater, no pattern deviations found.
>
> PASS

## Efficiency notes

Went smoothly overall, but two real detours cost extra time: (1) deciding *where* the guard's logic should live — the ticket names `scripts/ci-gate-guard.sh` or `.mjs` but the repo's actual convention for testable one-shot scripts (`.claude/rules/scripts.md`, `capture-usage.ts` precedent) is a dual-mode TS file inside a package with its own vitest/tsx tooling, invoked via a thin wrapper — required reading that rule plus the precedent file before writing any code. (2) A genuine bug caught by manual end-to-end smoke testing rather than the unit tests themselves: `pnpm --filter @questlog/core run ci-gate-guard` shifts the child process's cwd to `packages/core`, so the real (non-test) `fs`/`git` wiring was silently resolving every repo-relative path wrong — the guard passed on a diff it should have failed, with no error output. Caught only because I ran the CLI against real git commits, not just the injected-deps unit tests. Fixed by resolving `git rev-parse --show-toplevel` once and joining every path against it.

Separately: mid-way through manual verification I ran `git reset --hard` to discard throwaway smoke-test commits and it discarded uncommitted implementation work too (the guard script, its test, the wrapper, and the `package.json`/lockfile edits weren't committed yet). Recreated all of it from context with no functional difference, but it cost a full redo pass and is worth flagging as a process lesson: commit real work before running any `--hard` reset, even when the intent is only to discard *other*, unrelated throwaway commits.

**Retry log:** 2 retries — 1 `mechanical_lint_typecheck` (strict `noUncheckedIndexedAccess` errors on regex-match indexing, fixed with optional chaining/nullish coalescing), 1 `environment_setup` (this worktree's per-worktree Postgres needed manual provisioning — `QUESTLOG_PG_PORT` wasn't exported into the shell running `pnpm test`, causing `packages/core`'s suite to hit a stale/wrong database — not a bug in the ticket's own code).

## Anything Alex must decide

**Branch protection required-status-check wiring for `develop` couldn't be applied or even inspected from this session** — the GitHub API call 403s with "Upgrade to GitHub Pro or make this repository public to enable this feature." Once Pro/public access is available, add the new "Gate Guard" job as a required check on `develop` by hand (same as whatever check, if any, currently governs `doc-sync`/`migration-guard`/`mockup-guard`). Until then the job runs and reports on every PR but doesn't block a merge on its own.
