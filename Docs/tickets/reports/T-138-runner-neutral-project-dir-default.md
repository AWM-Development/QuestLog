# T-138 — Runner-neutral `CLAUDE_PROJECT_DIR` default

**Outcome:** shipped
**Branch:** feat/m-pipeline/t-138-runner-neutral-project-dir-default
**Diff:** 3 files changed, +60/-1 lines
**Complexity tier:** S
**Strategy-gate flag:** yes

## What shipped

`scripts/worktree-postgres-env.sh` and `.claude/hooks/session-start.sh` now default `CLAUDE_PROJECT_DIR` to `git rev-parse --show-toplevel` instead of hard-requiring it — a no-op under Claude Code (which always exports it), but a runner that doesn't export it now derives the same worktree-scoped path instead of hard-failing or silently colliding two concurrent agents onto one Postgres port/compose project.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (836 passed)
```

Fixture harness (`scripts/sim-worktree-env-fallback.sh`), run against a real `git worktree add` checkout with `CLAUDE_PROJECT_DIR` unset:

```
=== CLAUDE_PROJECT_DIR unset, cwd inside a worktree checkout ===
WORKTREE_NAME=T-999-fixture
PASS: WORKTREE_NAME correctly derived per-worktree with CLAUDE_PROJECT_DIR unset
```

Run again, before the fix, for the Red step (against the pre-edit `worktree-postgres-env.sh`):

```
=== CLAUDE_PROJECT_DIR unset, cwd inside a worktree checkout ===
scripts/worktree-postgres-env.sh: line 7: CLAUDE_PROJECT_DIR: CLAUDE_PROJECT_DIR must be set
```

## Exit condition check

- "all tests green, typecheck clean, lint clean" — see Test evidence above (`836 passed`, 0 lint warnings, typecheck clean).
- "a shell test ... demonstrates: with `CLAUDE_PROJECT_DIR` unset and cwd inside a worktree checkout, `worktree-postgres-env.sh` sourced still derives a `WORKTREE_NAME` matching the worktree's own directory name" — `scripts/sim-worktree-env-fallback.sh` builds a real bare repo + `git worktree add` checkout named `T-999-fixture`, unsets `CLAUDE_PROJECT_DIR`, sources the real `scripts/worktree-postgres-env.sh`, and asserts `WORKTREE_NAME == T-999-fixture` (not empty, not the clone/bare parent directory's name). Confirmed passing above.

## Reviewer verdict

PASS-WITH-NOTES.

> Confirmed. This is a small, well-scoped ticket. Verified the fixture script actually runs and passes (real `git worktree add`, real assertion on `WORKTREE_NAME`, not a stub).
>
> Findings:
>
> 1. **Comment-discipline duplication (check 7).** `.claude/hooks/session-start.sh:5-10` and `scripts/worktree-postgres-env.sh:7-11` carry near-identical 5-line rationale paragraphs explaining the same fact (Claude Code always exports the var, a runner that doesn't would hard-fail or, worse, silently collide) and both cite the same source (`G-020` § Notes 2). Per the reviewer checklist's cite-not-restate rule, this should collapse to one entry (in `IMPLEMENTATION_NOTES.md` once Step 7 runs) with a one-line pointer at each site, not the full rationale spelled out twice. Minor — doesn't affect correctness — but worth trimming on the remediation/Step-7 pass rather than carrying two long duplicate paragraphs forward.
>
> Everything else checks out:
> - Scope: both required call sites (`worktree-postgres-env.sh:12`, `session-start.sh:11`) get the exact `: "${CLAUDE_PROJECT_DIR:=$(git rev-parse --show-toplevel)}"` fallback specified in the ticket, placed before first use in each file.
> - Exit condition: `scripts/sim-worktree-env-fallback.sh` builds a real bare repo + `git worktree add` checkout, unsets `CLAUDE_PROJECT_DIR`, sources the real script, and asserts `WORKTREE_NAME` equals the worktree's own directory name (not empty, not a parent name) — actually run and confirmed to pass, not theater.
> - Out of scope respected: no change to downstream usage of the derived value, no second-runner wiring, no `AGENTS.md`/observability `runner` dimension work.
> - No scope creep: only the ticket-file move (queue→in-progress) plus the two script edits and the new fixture — nothing extraneous.
> - No DRY/sprawl beyond the comment-duplication note above; no functional helper duplicated.
> - Mechanistic trace of the one substantive line (`: "${VAR:=...}"` fallback) is a standard, safe bash idiom; failure path (`git rev-parse --show-toplevel` outside a repo) matches existing assumptions elsewhere in the codebase and isn't a regression this ticket introduces.
>
> PASS-WITH-NOTES

**Remediation applied post-review:** collapsed both scripts' comment blocks down to a one-line pointer (`# Runner-neutral default — see Docs/IMPLEMENTATION_NOTES.md § T-138.`) and moved the full rationale into a single `IMPLEMENTATION_NOTES.md` § T-138 entry, per the reviewer's note. Re-ran the fixture harness and the full lint/typecheck/test gate after the trim — both still pass (see Test evidence).

## Efficiency notes

Straightforward — the ticket's own Relevant background section already inlined the exact fix and the exit condition's exact assertion, so no extra context pulls were needed beyond the three named Context files. Most of the turns went into writing and validating the fixture harness (a real `git worktree add` checkout, not a stubbed directory) rather than the two-line fix itself.

**Retry log:** 0 retries. One Red→Green cycle: the fixture harness failed for the expected reason (`CLAUDE_PROJECT_DIR must be set`) against the unmodified script, then passed once the fallback was added to both files — no failed attempts beyond that.

## Anything Alex must decide

**Deliberate deviation from the `T-073`/`sim-claim-step.sh` precedent, flagging rather than silently doing it:** `sim-claim-step.sh` was dropped from the repo after its ticket (its race-condition demo was reimplemented synthetically outside the real code, so once its output was pasted into the report it had no ongoing value). `scripts/sim-worktree-env-fallback.sh` was kept instead — it sources the real, shipped `worktree-postgres-env.sh` against a real `git worktree add` checkout, so it's cheap to keep and now stands as a live regression check against this exact fallback silently reverting. Not wired into `scripts/run-tests-quiet.sh` (that only runs `pnpm lint`/`typecheck`/`test`, not standalone shell scripts) — it's a manually-run fixture, same invocation shape as `sim-claim-step.sh` was. If this convention should instead always drop the script (matching `T-073` exactly), say so and it can be removed.

Otherwise: none.
