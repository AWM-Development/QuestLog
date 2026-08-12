# T-146 — `/lineup`: milestone progress + deployed version tracking

**Outcome:** shipped
**Branch:** feat/m-efficiency/t-146-lineup-milestone-progress-deployed-version
**Diff:** 3 files changed, +5/-1 lines (plus this report and cost-report artifact)
**Complexity tier:** D
**Strategy-gate flag:** no

## What shipped

Formal close-out of a ticket whose actual scope was already implemented and merged to `develop` directly during its own drafting session (commits `c318a4d`/`ccfd6cd`, both already on `origin/develop` before this branch was cut) — the "📈 Milestone Progress & Deployed Version" section in `.claude/commands/lineup.md`'s Output template and procedure, plus the worked example in `Docs/tickets/LINEUP_SAMPLE.md`, were written to illustrate the ticket while drafting it and landed on `develop` at that point. This ticket's own branch therefore carries zero further code/doc changes to that scope — I verified every exit-condition item against the already-merged content (see below) and closed the ticket's remaining definition-of-done items: milestone checkbox, `CHANGELOG.md` entry, this report.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (865 passed)
```

D-tier: a single end-of-work `scripts/run-tests-quiet.sh` pass, no per-checkpoint TDD loop (nothing to TDD — no code was written this run).

## Exit condition check

- **Output template contains the new section, in the specified position, with concrete field placeholders:** `.claude/commands/lineup.md` lines 59–76 — "## 📈 Milestone Progress & Deployed Version" sits directly after "## ⚾ At Bat / On Deck / In the Hole" and before "## 🔍 Open PRs Awaiting Review", with placeholders for all three parts (completed-milestone one-liners, deployed version + promotion date, next milestone + remaining tasks).
- **Procedure section gains corresponding numbered step(s), matching existing specificity, naming which branch/file each read comes from and which scan logic the remaining-tasks list reuses:** `.claude/commands/lineup.md` Step 4 (lines 17–26) — names `origin/main`/`origin/develop` per sub-part, and explicitly reuses `.claude/skills/ticket-writer/SKILL.md`'s "what's next" mode scan logic for the remaining-tasks list.
- **`LINEUP_SAMPLE.md` updated with the specified 2026-08-07 worked example:** `Docs/tickets/LINEUP_SAMPLE.md` lines 30–55 — completed milestones lists `v1` with its one-liner; deployed version reads `v1.1.1` promoted `2026-08-02` (matches `CHANGELOG.md`'s `## [1.1.1] - 2026-08-02` header); next milestone identifies `MILESTONES_V1_1_MCP.md` (v1.1), listing all 15 unchecked tasks with per-task real ticket status, specifically demonstrating the checkbox-drift case (M-REMOTE.7/M-CICD.1/M-CICD.2/M-CICD.3 reported as "✅ shipped, checkbox not yet updated" rather than counted as remaining) and the corrected "10 actually remaining" count.
- **`pnpm lint && pnpm typecheck && pnpm test` all pass:** see Test evidence above.

## Reviewer verdict

N/A — D tier; independent verification deferred to Alex's manual `/morning-review`.

## Efficiency notes

Unusual run: Step 3 context-loading turned up that the ticket's own Scope was already fully satisfied on `origin/develop` before this branch was even cut — confirmed by diffing the current worktree's `.claude/commands/lineup.md`/`Docs/tickets/LINEUP_SAMPLE.md` against every exit-condition bullet line-by-line rather than assuming. No implementation work was needed; the run consisted of verification plus the standard definition-of-done close-out (milestone checkbox, changelog, report). Flagged transparently below rather than silently treating this as a normal from-scratch implementation.

**Retry log:** 0 retries — no implementation, so nothing to iterate on the cap against.

## Anything Alex must decide

None to *decide*, but worth knowing: this ticket's actual deliverable (the `/lineup` template/procedure change and worked `LINEUP_SAMPLE.md` example) was written directly to `develop` during T-146's own ticket-drafting session, not through this ticket's own branch/PR/review cycle — `Docs/milestones/MILESTONES_V1_2_MCP.md`'s own M-EFFICIENCY.21 note corroborates this ("drafting this ticket found real cases of shipped tickets whose milestone checkbox was never flipped," describing exactly the worked example now in `LINEUP_SAMPLE.md`). This PR only exists to formally close out the ticket's remaining definition-of-done items against content that was, functionally, already reviewed and merged as part of the drafting commits. Worth considering for future ticket-writer sessions whether illustrative "worked examples" drafted directly into `develop` should route through the normal ticket pipeline instead, so a ticket's PR always carries its own diff.
