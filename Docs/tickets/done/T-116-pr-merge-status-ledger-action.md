# T-116 — PR-merge GitHub Action as ticket-status source of truth

Milestone ref: M-EFFICIENCY.6 (`Docs/milestones/MILESTONES_V1_2_MCP.md`)

Complexity tier: L

Strategy-gate flag: no

Priority: P0

Branch: feat/m-efficiency/t-116-pr-merge-status-ledger-action

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md (Steps 0, 1, 2, 6, 7 — Step 1 is
    what this ticket rewrites; 0/2/6/7 establish the worktree, claim-
    push, blocked, and shipped mechanics this ticket must not break)
  - Docs/tickets/TICKET_SPEC.md (Lifecycle section, specifically "Why
    `develop`'s ticket directories can lag reality" — this ticket
    changes the mechanism that section describes and the section's text
    must be updated to match)
  - .github/workflows/ci.yml (existing action-version pins and
    conventions — `actions/checkout@v5`, permissions style — to match
    rather than diverge from)
  - .claude/commands/executor.md
  - .claude/commands/promote-execute.md

## Relevant background
excerpted from `Docs/IMPLEMENTATION_NOTES.md` § T-069, as of 2026-08-02

T-069 made a ticket's claim real: Step 2 pushes the claiming branch
before implementation starts, turning Step 1's dedup check from a
check-then-act race into a real mutex. The verified-empirically note
from that section applies directly here too — T-069's push-permission
question ("does the git proxy allow creating a new branch name") was
answered by testing it live in this repo rather than assuming, and this
ticket has an analogous open question: no GitHub Actions workflow in
this repo has ever committed back into a branch (`git log
--all --grep="github-actions\[bot\]"` finds nothing, and no existing
workflow file sets `permissions: contents: write` or runs `git push`).
Whether the default `GITHUB_TOKEN` can push to `develop` as-is, or
whether `develop` branch protection (if any is configured on GitHub,
not visible from this checkout) blocks it and a PAT/service-account
secret is required instead, is exactly the kind of thing to verify
empirically during implementation and record in `IMPLEMENTATION_NOTES.md`
once known — not assumed either way going in.

Mockup: none

Model: sonnet

Scope:
  Selection currently costs 11+ tool calls and several minutes per
  nightly run (`EXECUTOR_ROUTINE.md` Step 1): a full paginated
  `gh pr list --state all --limit 100` history scan plus a full
  `git ls-remote --heads origin`, re-derived from scratch every single
  run, to classify each `queue/`/`in-progress/` candidate against
  GitHub's live PR/branch state. This ticket makes PR-merge state
  push-based instead of pull-based, so most nights don't need the full
  historical re-scan at all:

  1. **New workflow: a merge-triggered ledger writer.** Add
     `.github/workflows/ticket-status-ledger.yml`, triggered on
     `pull_request` events (`types: [closed]`) targeting `develop`,
     guarded by `github.event.pull_request.merged == true`. Also support
     `workflow_dispatch` with `pr_number` and `dry_run` inputs, so it can
     be validated against a real, already-merged PR without waiting on a
     new merge (see Exit condition). Extract the ticket id from the
     merged PR's head branch name (`feat/<group>/t-###-<slug>` — same
     pattern `EXECUTOR_ROUTINE.md` Step 1 already parses) and upsert an
     entry into a small JSON ledger — recommended location
     `Docs/tickets/.merge-ledger.json` — recording `{ ticketId, prNumber,
     branch, mergedAt }`. `dry_run: true` must log what it would write
     without committing anything. A non-dry-run write commits directly
     to `develop` (see the empirical permissions question in "Relevant
     background" above) with a message like
     `chore: record T-### merge in ledger [skip ci]` — tag it to skip
     triggering `ci.yml` on a docs-only bot commit, matching how
     `doc-sync`/`impl-notes-health` already treat non-code changes as
     lower-stakes. **Idempotent upsert, not append** — invoking the
     workflow twice for the same PR must leave exactly one ledger entry
     for that ticket id, not a duplicate.
  2. **Rewrite `EXECUTOR_ROUTINE.md` Step 1's candidate classification.**
     Read the ledger first. A candidate whose ticket id already has a
     ledger entry needs no further check for the "already merged" case —
     this is a defensive/edge-case path in practice (a ticket's own PR
     merge already moves its file out of `queue/`/`in-progress/` via
     Step 7's own commit, so a merged ticket is rarely still a
     candidate at all; the ledger exists for the cases that current
     Step 1 documentation already flags as real — e.g. the title-vs-
     branch false-positive risk, or any edge case where the file move
     didn't happen for some reason). The actual cost cut: for genuinely
     ambiguous candidates (open PR, or a claimed-but-unmerged branch —
     cases 2 and 4 in the current routine), replace the full paginated
     `gh pr list --state all --limit 100` history scan and full
     `git ls-remote --heads origin` with a **narrow, per-candidate**
     live check (e.g. `gh pr list --head <branch> --state all --json ...`
     or `gh pr view <branch>`) — cheap because it only runs for the
     handful of candidates the ledger didn't resolve, not the whole
     repo's PR history every night.
  3. **Preserve every existing correctness property.** This is a
     rewrite of *how* Step 1 gets its answers, not a relaxation of what
     it checks for: keep the `merged_at`/`mergedAt`-presence rule (never
     trust a bare `merged` boolean from a REST listing — note that the
     Action's own `pull_request.merged` webhook field is a different,
     synchronous-with-the-merge context and *is* trustworthy there, so
     be explicit in the routine text about why that distinction holds
     and doesn't quietly relax the listing-based warehouse rule
     elsewhere); keep matching by branch name, never by PR title (the
     8-of-20 filing-PR false-positive case already documented in Step
     1); keep the `STALENESS_THRESHOLD_HOURS = 6` staleness check and
     case-4 resume-from-abandoned-branch logic entirely intact — the
     ledger has nothing to say about an unmerged, actively-claimed
     branch, so that path is untouched by this ticket.
  4. **Full documentation update.** `EXECUTOR_ROUTINE.md` Step 1: replace
     the full-scan instructions with the ledger-first, narrow-fallback
     version, and add a short pointer (mirroring Step 0's worktree
     pointer to `IMPLEMENTATION_NOTES.md` § T-069) describing the ledger
     file and the Action that maintains it. `TICKET_SPEC.md`'s "Why
     `develop`'s ticket directories can lag reality" section: update it
     to describe the ledger mechanism rather than only the old full-scan
     approach — the underlying lag (a claimed branch's `in-progress/`
     move only lands on the feature branch until merge) is unchanged and
     stays documented; only the *detection* mechanism changes.
     `Docs/IMPLEMENTATION_NOTES.md`: new entry documenting the ledger
     format/location, the workflow's trigger and `dry_run` design, and
     whatever the empirical `contents: write` permissions check found.

Out of scope:
  - Changing Step 2's claim-push mutex mechanics, or Step 6's blocked-
    ticket handling (still pushes without opening a PR — this ticket's
    Action only fires on *merged* PRs, so blocked tickets are entirely
    untouched by it).
  - Removing the narrow live-GitHub-check fallback for anything the
    ledger doesn't cover (open PRs, claimed-but-unmerged branches) —
    the ledger is an optimization for the already-resolved case, never
    a substitute for a live check on a genuinely ambiguous candidate.
  - Backfilling ledger entries for tickets merged before this Action
    exists. The ledger starts empty; historical gaps are fine since
    Step 1's fallback path still covers anything missing.
  - Any relation to M-OBS's Neon-backed observability store
    (`packages/observability`) — this ledger is small, repo-local,
    ticket-selection state, not part of that system, and must not be
    confused with or merged into it.
  - Building a general-purpose GitHub state cache beyond ticket-status
    classification.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `actionlint` passes against the new workflow file (mirrors `ci.yml`'s
    own "Workflow Self-Validation" job)
  - a `workflow_dispatch` invocation with `dry_run: true` against a real,
    already-merged ticket PR (e.g. a recent `T-###` PR merged into
    `develop`) logs the correct ledger entry it *would* write, and
    produces no new commit (confirmed via the run log and `git log`)
  - a `workflow_dispatch` invocation with `dry_run: false` against that
    same PR commits exactly one ledger entry for that ticket id to
    `develop`; invoking it a second time for the same PR leaves exactly
    one entry for that ticket id (idempotent upsert, not a duplicate)
  - `grep`/read against `EXECUTOR_ROUTINE.md` Step 1 confirms it reads
    the ledger before any live GitHub check, and confirms the full
    paginated `--state all --limit 100` history scan and full
    `git ls-remote --heads origin` are no longer the unconditional
    default path
  - `grep`/read against `TICKET_SPEC.md`'s "Why `develop`'s ticket
    directories can lag reality" section confirms it describes the
    ledger mechanism, not only the superseded full-scan approach
  - `Docs/IMPLEMENTATION_NOTES.md` has a new entry documenting the
    ledger format/location, the Action's trigger design, and the
    `contents: write` permissions outcome

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped for M-EFFICIENCY.6 in
  `Docs/milestones/MILESTONES_V1_2_MCP.md`, `IMPLEMENTATION_NOTES.md`
  updated (required by this ticket's own scope, not just "if non-obvious"
  — see Exit condition), a `CHANGELOG.md` entry under `[Unreleased]`,
  morning report written.
