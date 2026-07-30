# T-070 — Convert the remaining shared-tree mutators to T-069's worktree convention

**Outcome:** shipped
**Branch:** feat/m-pipeline/t-070-convert-remaining-shared-tree-mutators
**Diff:** 6 files changed, +7/-9 lines (docs-only)

## What shipped

The three remaining commands/skills that checked out or stashed directly in the shared primary working directory now follow T-069's per-session worktree convention (or, for `/lineup`, need no working-tree mutation at all — it's genuinely read-only now). One `/lineup` run mid-executor can no longer undo T-069's isolation.

## Test evidence

```
pnpm lint
 Tasks:    6 successful, 6 total
Cached:    6 cached, 6 total
  Time:    112ms >>> FULL TURBO

pnpm typecheck
 Tasks:    6 successful, 6 total
Cached:    6 cached, 6 total
  Time:    92ms >>> FULL TURBO

pnpm test
@questlog/core:test:  Test Files  27 passed (27)
@questlog/core:test:       Tests  236 passed (236)
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  39 passed (39)
@questlog/server:test:  Test Files  14 passed (14)
@questlog/server:test:       Tests  102 passed (102)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
```

No application code changed, so this is the unaffected existing suite — included to confirm the docs-only diff broke nothing.

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above.
- **`grep -rlE 'checkout -B develop|git stash' .claude/commands/ .claude/skills/` returns no file** — verified directly, empty output.
- **`.claude/commands/lineup.md` contains no `git checkout` at all, reads via `origin/develop`** — Step 1 now reads `git fetch origin develop` only, and describes reading ticket files via `git show origin/develop:<path>`, following `.claude/commands/promote.md:12`'s existing pattern. Verified `git show origin/develop:Docs/tickets/queue/` and `.../backlog/` both list correctly against the real repo.
- **`Docs/tickets/COMMANDS.md`'s `/lineup` row justifies `Unattended-safe? Yes` on the read-only implementation** — updated to cite the `git show origin/develop:<path>` read path instead of the old force-checkout.
- **`morning-review.md` and `ungate/SKILL.md` each create/enter their own worktree, `morning-review.md` no longer stashes** — both now do `git worktree add tmp/worktrees/<name>/ ...`; `git stash -u` deleted outright from `morning-review.md`, not kept as a fallback (a fresh worktree has nothing to stash).
- **`ungate/SKILL.md` still cuts a `gates/<gate-slug>`-prefixed branch** — unchanged, only where it's cut moved into the new worktree.
- **`/lineup`'s read path against `origin/develop` produces the same ticket list as the pre-change implementation** — `diff <(git show origin/develop:Docs/tickets/queue/) <(ls Docs/tickets/queue/)` against the real `queue/` directory returns only the expected `.gitkeep` delta, confirming behavior-preservation.

`ticket-writer/SKILL.md` step 0 had the same shape (`tickets/<milestone-slug>` branch cut in the shared directory) and was mechanical to convert — done, following the ticket's own "convert it if that is mechanical" instruction.

## Reviewer verdict

**PASS.** Verbatim:

> Both untouched, as expected pre-Step-7. This is a clean, tightly-scoped docs-only diff.
>
> Findings:
>
> - `.claude/commands/lineup.md:9` — converted from `git checkout -B develop origin/develop` to `git fetch origin develop` + `git show origin/develop:<path>`, correctly following `promote.md`'s reference pattern. Verified empirically (`git show origin/develop:Docs/tickets/queue/` and `.../backlog/` both list correctly), satisfying the exit condition's behavior-preservation requirement.
> - `Docs/tickets/COMMANDS.md` `/lineup` row now justifies `Unattended-safe? Yes` on the read-only `git show` implementation rather than the old force-checkout — matches exit condition 3.
> - `.claude/commands/morning-review.md:14` — `git stash -u` deleted entirely (not kept as fallback, per ticket instruction) and replaced with `git worktree add tmp/worktrees/review-<head-branch>/ <head-branch>`, matching T-069's resume-existing-branch shape (`Docs/IMPLEMENTATION_NOTES.md:765`'s documented pattern for entering an existing branch without `-b`).
> - `.claude/skills/ungate/SKILL.md:18` — now creates `tmp/worktrees/<gate-slug>/ -b gates/<gate-slug> origin/develop`; `gates/*` prefix preserved unchanged, as required.
> - `.claude/skills/ticket-writer/SKILL.md:28` — converted to the same worktree shape (`tmp/worktrees/<milestone-slug>/ -b tickets/<milestone-slug> origin/develop`); ticket allowed this only "if mechanical," and it is — matches the other three exactly.
> - `grep -rlE 'checkout -B develop|git stash' .claude/commands/ .claude/skills/` returns no file — exit condition 1 confirmed directly.
> - No files outside the ticket's named scope were touched (`promote.md`, `executor.md`, `promote-execute.md`, `archive-implementation-notes.md`, `EXECUTOR_ROUTINE.md` all verified diff-empty against develop) — no scope creep.
> - Comment/pointer discipline is respected: the stash-removal rationale is stated in full once (`morning-review.md:14`) and referenced by a one-line pointer everywhere else.
> - `IMPLEMENTATION_NOTES.md`, `CHANGELOG.md`, and the milestone checkbox are untouched — expected, since this review runs before Step 7 bookkeeping.
>
> No pattern deviation, no functionality gap against Scope, no test theater (nothing to test — docs-only), and no DRY/sprawl issue found in this diff.
>
> PASS

## Anything Alex must decide

None. Worktree reaping/cleanup automation remains unticketed (flagged again per the ticket's own instruction — still true after this lands).
