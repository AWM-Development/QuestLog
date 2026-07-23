# T-041 — Fix session-start.sh's develop-sync guard clobbering committed-but-unmerged changes

**Outcome:** shipped
**Branch:** feat/m-mcp/t-041-session-start-develop-sync-guard
**Diff:** 3 files changed, +35/-6 lines

## What shipped

`.claude/hooks/session-start.sh`'s develop-sync step used to gate the `git checkout origin/develop -- .claude/commands .claude/skills` sync on `git status --porcelain` alone — uncommitted diffs only. Once a branch **committed** its own edit to a file that already exists on `develop` (merged or not), the working tree looked clean and the guard silently overwrote that committed content with develop's stale copy. Observed twice in one real session against `.claude/skills/ticket-writer/SKILL.md`.

The guard now computes `git merge-base HEAD origin/develop` and, per file (not per directory), only checks out a file from `origin/develop` when it's identical to that merge-base copy — covering both the old invariant (an untouched file still syncs) and the new one (a file the branch has committed since the merge-base, working-tree-clean or not, is left alone). Per-file granularity was a deliberate choice over the smaller directory-level diff, so a committed-but-unmerged file in `.claude/skills` no longer blocks syncing unrelated untouched files in the same directory — see `Docs/IMPLEMENTATION_NOTES.md` § T-041 for the full reasoning.

## Test evidence

No TypeScript touched — `pnpm lint` / `pnpm typecheck` ran clean (full-turbo cache hit, no changes to invalidate):

```
Tasks:    4 successful, 4 total
Cached:    4 cached, 4 total
```

Ticket's exit condition is a scripted repro against a scratch git sandbox (bash hook, no existing test framework for `.claude/hooks/*`, out of scope to add one per the ticket). Harness builds a real bare "origin" + cloned "session" checkout, seeds three files (untouched, committed-but-unmerged edit, branch-only new file) in one working tree, and runs the guard block extracted verbatim from the real file between `# --- develop-sync guard: begin/end ---` markers.

**Against the pre-fix guard** (red — proves the bug):

```
=== T-041 repro — mode: old ===
[PASS] scenario 1 (untouched file synced to develop's latest): develop v2 — untouched.md
[FAIL] scenario 2 (committed-unmerged edit should survive): got 'develop v2 — edited.md'
[PASS] scenario 3 (new branch-only file left alone, no-op): present and unchanged
=== SOME FAILED ===
```

**Against the fixed guard** (green):

```
=== T-041 repro — mode: new ===
[PASS] scenario 1 (untouched file synced to develop's latest): develop v2 — untouched.md
[PASS] scenario 2 (committed-unmerged edit left untouched): branch's own edit — edited.md
[PASS] scenario 3 (new branch-only file left alone, no-op): present and unchanged
=== ALL PASS ===
```

A fourth, ad hoc check (not part of the committed-scenario harness) confirmed the pre-existing **uncommitted**-edit invariant — the original guard's actual purpose — still holds under the new logic: an uncommitted local edit to a merge-base-tracked file survives the sync unchanged.

`shellcheck` is not installed in this sandbox — noted per the ticket's fallback instruction rather than installing new tooling.

## Anything Alex must decide

- **Ticket file lands straight in `done/`, no `queue/`/`in-progress/` stop.** This ticket was drafted and implemented in the same interactive session, ahead of the normal nightly-queue order (Alex's explicit request), on a separate ticket-creation PR (#79) that was still open when implementation started. Rather than wait on #79 to merge and leave a manual follow-up move, the ticket file is added directly to `Docs/tickets/done/` in this PR, and PR #79 is closed as superseded — this PR is now the sole source of truth for T-041's full lifecycle (drafted → shipped in one shot), matching `TICKET_SPEC.md`'s documented "queue straight to done in one shot" pattern for how tickets actually land on `develop`.
- No other open questions — the fix, tests, and docs are complete and self-contained.
