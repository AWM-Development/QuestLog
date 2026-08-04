# T-116 — PR-merge GitHub Action as ticket-status source of truth

**Outcome:** shipped
**Branch:** feat/m-efficiency/t-116-pr-merge-status-ledger-action
**Diff:** 8 files changed, +244/-13 lines
**Complexity tier:** L
**Strategy-gate flag:** no

## What shipped

A new merge-triggered GitHub Action (`.github/workflows/ticket-status-ledger.yml`) that writes `{ ticketId, prNumber, branch, mergedAt }` into `Docs/tickets/.merge-ledger.json` whenever a `feat/<group>/t-###-<slug>` branch merges into `develop` (also invocable on demand via `workflow_dispatch` with `pr_number`/`dry_run` inputs). `EXECUTOR_ROUTINE.md`'s Step 1 pre-flight now reads this ledger first and only falls back to a narrow, per-candidate live GitHub check (a head-filtered PR query plus a single-ref branch check) for whatever the ledger doesn't resolve — replacing every run's full paginated PR-history scan and full `git ls-remote --heads origin` listing. `TICKET_SPEC.md`'s "why develop's ticket directories can lag reality" section describes the new mechanism.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (719 passed)
```

Full `pnpm turbo lint`/`typecheck`/`test` output (post-remediation re-run, `apps/core`+`apps/server`+`apps/mcp-stdio`+`apps/web` etc., turbo cache-hit since no TS changed since the prior clean run):

```
@questlog/core:lint: Checked 64 files in 234ms. No fixes applied.
@questlog/server:lint: Checked 42 files in 177ms. No fixes applied.
 Tasks:    7 successful, 7 total
Cached:    7 cached, 7 total
  Time:    77ms >>> FULL TURBO

 Tasks:    7 successful, 7 total (typecheck)
Cached:    7 cached, 7 total
  Time:    72ms >>> FULL TURBO

@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
 Tasks:    6 successful, 6 total (test)
Cached:    6 cached, 6 total
  Time:    79ms >>> FULL TURBO
```

`719 passed` is `scripts/run-tests-quiet.sh`'s aggregate across every package's test task in the same run.

`actionlint -color` (downloaded per `ci.yml`'s own "Workflow Self-Validation" job convention) against the full `.github/workflows/` directory: clean exit, no output, both before commit and again after the remediation pass.

## Exit condition check

- **all tests green, typecheck clean, lint clean** — met, see Test evidence above.
- **`actionlint` passes against the new workflow file** — met, confirmed twice (pre- and post-remediation).
- **`workflow_dispatch` with `dry_run: true` against a real merged PR logs the entry without committing** — **not verified pre-merge.** Confirmed empirically that GitHub's `workflow_dispatch` API only dispatches a workflow that already exists on the repo's default branch (`main` here) — a live dispatch attempt against this feature branch returned `404 Not Found`, and `list_workflows` doesn't list this workflow at all yet. This can't be satisfied from within this ticket's own branch, nor even immediately after merging to `develop` (still not `main`). See `Docs/IMPLEMENTATION_NOTES.md` § T-116 and "Anything Alex must decide" below.
- **`workflow_dispatch` with `dry_run: false` commits exactly one entry, idempotent on a second call** — same platform constraint, not verified pre-merge. The upsert/idempotency *logic* was verified locally against a hand-rolled jq harness mirroring the workflow's own steps (insert, insert-different, re-insert-identical → `changed=false`, no duplicate).
- **`EXECUTOR_ROUTINE.md` Step 1 reads the ledger before any live GitHub check, full scan no longer the unconditional default** — met, `grep -n "merge-ledger.json\|Ledger-first"` and `grep -n "narrow, per-candidate live check"` both confirm.
- **`TICKET_SPEC.md`'s lag section describes the ledger mechanism** — met, `grep -n "merge-ledger.json\|ticket-status-ledger"` confirms.
- **`IMPLEMENTATION_NOTES.md` has a new entry documenting format/trigger/permissions outcome** — met for format and trigger design; the `contents: write` push-permission outcome is explicitly recorded as **still empirically unverified**, for the same platform-constraint reason as the two live-dispatch bullets above — not assumed either way, per the ticket's own instruction.

## Reviewer verdict

**Initial pass: FAIL.** Two findings, both with file:line references:
1. Script injection at `ticket-status-ledger.yml:99` — `steps.pr.outputs.branch` (derived from untrusted PR-author-controlled branch text) interpolated directly into a `run:` script body via `${{ }}` instead of `env:`, the same vulnerability class the diff's own comment claimed was already fixed one hop earlier. `actionlint` doesn't catch this because its untrusted-input check only tracks `github.*` context expressions, not values that round-tripped through a `steps.*.outputs.*`.
2. `EXECUTOR_ROUTINE.md`'s "Dropped in this rewrite" paragraph framed the removed pre-2026-07-16 `claude/*`-branch matching as purely historical, when Step 2 still documents `claude/*` as a live, standing push-rejection fallback — a correctness-property-preservation concern per the ticket's own scope.

**Remediation (one pass, per Step 5):**
1. Fixed the flagged instance, and during the fix found and closed a *third* occurrence of the same class the reviewer hadn't flagged (`echo '${{ steps.compute.outputs.entry }}'` in the dry-run logging step — a JSON string doesn't escape a literal single quote, so an embedded `'` in an untrusted branch name would have broken out of the shell string). Both routed through `env:`. Re-audited the whole file (`grep -n '\${{ steps\.'`) afterward — the only remaining direct interpolations are values this workflow itself derives (a regex-validated `T-\d+` ticket id, a literal `true`/`false`), not untrusted PR data.
2. Re-checked the claim against the pre-T-116 routine's own git history: the `claude/*` accommodation really was scoped to "runs before 2026-07-16" only even before this ticket, and the historical `rename-ticket-branch.yml` Action that used to reconcile a `claude/*` push back to the nominal branch name was deleted in the same 2026-07-16 cutover (PR #49). So this is a genuine, *pre-existing* gap neither the old nor new Step 1 ever closed — not a regression this rewrite caused. Corrected the paragraph to say so plainly instead of implying it's resolved or purely historical, and flagged it for a follow-up ticket.

Re-ran `actionlint` (clean) and the full lint/typecheck/test chain (clean) after the remediation pass. Per Step 5, this was the one remediation attempt; proceeding to Step 7 regardless of a second review round.

## Efficiency notes

Most of the session's time went to Step 1 pre-flight itself (candidate selection across ~35 backlog/queue tickets, two full paginated `list_pull_requests` calls to build the dedup baseline before this ticket's own change could even start) and to empirically confirming the `workflow_dispatch`/default-branch constraint (a live dispatch attempt, then cross-checking `list_workflows` and an already-registered workflow's `html_url` to be sure it wasn't a naming mistake) rather than assuming it. The reviewer's FAIL caught a real defect class I should have caught myself on the first pass — having fixed the `actionlint`-flagged instance, I didn't immediately grep the rest of the file for the same pattern until prompted to explain the fix's completeness; doing that grep as a matter of course before finishing the "Extract ticket id" checkpoint would have caught all three instances in one pass instead of two.

**Retry log:** 1 retry — `genuine_bug_caught_by_test` in the loose sense that it was the `reviewer` subagent, not an automated test, that caught the defect: 2 real script-injection instances plus 1 documentation-accuracy issue, all fixed in the single remediation pass described above. 0 `environment_setup` retries (worktree Postgres/pnpm install went cleanly once `pnpm install` was run). 0 `mechanical_lint_typecheck` retries.

## Anything Alex must decide

1. **The two live-`workflow_dispatch` exit-condition checks need a manual pass once this workflow reaches `main`.** GitHub only allows dispatching a workflow that already exists on the repo's default branch (confirmed via a live `404`) — this ticket's branch, and even `develop` post-merge, can't satisfy this. Once this PR merges and later promotes to `main`: run `workflow_dispatch` with `dry_run: true` against a recent merged `T-###` PR (confirm it logs the entry and commits nothing), then `dry_run: false` against the same PR (confirm exactly one commit/ledger entry), then dispatch it a second time with `dry_run: false` (confirm idempotency — still exactly one entry).
2. **Whether the default `GITHUB_TOKEN` can actually push to `develop` (vs. needing a PAT/service-account secret for `contents: write`) is still unverified**, for the identical platform-constraint reason — this repo has never had a workflow commit back into a branch before. The manual dispatch above will also answer this: if the "Commit ledger update to develop" step fails on `git push`, `develop` needs branch-protection-aware credentials this workflow doesn't have yet.
3. **A pre-existing, still-open gap surfaced during review (not introduced by this ticket):** if a ticket's Step 2 push under its nominal `Branch:` name is ever rejected and falls back to the session's harness-assigned `claude/*` branch, no version of Step 1 — before or after this rewrite — can discover that branch again (the old routine's `claude/*` matching was scoped to pre-2026-07-16 runs only, and the Action that used to reconcile a `claude/*` push back to the nominal branch name was deleted in that same cutover). Out of this ticket's own scope to fix (T-116 only changes *how* the two already-documented matching mechanisms get their answers). Worth its own ticket if a Step 2 push rejection is ever actually observed in practice.
4. **T-081 was auto-promoted from `backlog/` to `queue/`** during this run's Step 1/2 (its blocker, T-080, merged) — routine housekeeping, not part of this ticket's own scope, called out here only so it's visible in this diff.
