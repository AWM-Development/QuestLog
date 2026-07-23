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

- **Ticket-lifecycle bookkeeping is temporarily out of sync, by construction.** This ticket (`Docs/tickets/queue/T-041-session-start-develop-sync-guard.md`) was drafted and queued on a separate ticket-creation branch/PR (`tickets/t-041-session-start-develop-sync-guard`, PR #79) that hasn't merged into `develop` yet — `Blocked on:`/`Gated on:` don't apply here since this was explicitly requested to be implemented immediately, ahead of the normal queue order. This implementation branch was cut from `develop` directly (per CLAUDE.md, this session never merges a PR itself), so the ticket file doesn't exist on it to `git mv` from `queue/` to `done/` the normal way. Once PR #79 merges, a small follow-up commit on `develop` (`git mv Docs/tickets/queue/T-041-session-start-develop-sync-guard.md Docs/tickets/done/`) closes this out — this is the same "develop's ticket directories can lag reality" pattern `TICKET_SPEC.md` already documents, just via a different cause (parallel session, not executor interruption) than the doc's own examples.
- No other open questions — the fix, tests, and docs are complete and self-contained.
