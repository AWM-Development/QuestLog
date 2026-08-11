# T-128 — CI job-count / GitHub Actions minutes audit

**Outcome:** shipped
**Branch:** feat/m-efficiency/t-128-ci-actions-minutes-audit
**Diff:** 1 file changed (this report), additive-only
**Complexity tier:** S
**Strategy-gate flag:** no

## What shipped

A single markdown deliverable quantifying real GitHub Actions minute
consumption across all five workflow files (`ci.yml`,
`e2e-release-check.yml`, `smoke-test-dev.yml`, `smoke-test-prod.yml`,
`ticket-status-ledger.yml`), pulled from live `gh api` run/job data rather
than estimated from the YAML, plus concrete ranked reduction options.
Recommendations only — nothing under `.github/workflows/` is touched.

---

## Audit

### Staleness corrections before the numbers (found live, worth flagging up front)

- **`ci.yml`'s job count is 7 today, not 9.** The milestone-doc figure this
  ticket's own background note already flagged as stale ("7 jobs") is now
  doubly stale in the other direction — `gate-guard`/`scope-guard`/
  `report-guard` did land (3 new jobs, as the background note anticipated),
  but `doc-sync`, `migration-guard`, `mockup-guard`, and `impl-notes-health`
  are no longer four separate jobs — `T-121` (`Docs/tickets/done/T-121-ci-guard-jobs-shared-checkout.md`)
  already consolidated all four into one `guards` job sharing a single
  checkout + diff computation. Current job list, confirmed directly from
  `ci.yml`: `pr`, `guards`, `gate-guard`, `scope-guard`, `report-guard`,
  `red-check`, `actionlint` — 7, not 9.
- **T-120/T-121 are shipped, not "still queued.".** This ticket's own
  background section (excerpted from `G-035`) says the checkout/diff
  duplication was "partially addressed by the still-queued T-120/T-121" —
  both are in `Docs/tickets/done/` today (`T-120-ci-composite-actions.md`,
  `T-121-ci-guard-jobs-shared-checkout.md`). `T-120` built the
  `.github/actions/setup-repo` composite action every job now uses;
  `T-121` built the `guards` consolidation above. Neither reduction option
  below re-derives what those two already fixed.

### 1. Real minute consumption per workflow

Pulled via `gh api repos/AWM-Development/QuestLog/actions/workflows/<id>/runs`
(most recent 30 completed runs per workflow, or all available runs where
fewer than 30 exist) plus a per-run `gh api .../actions/runs/<id>/jobs`
call to get each job's real `started_at`/`completed_at` timestamps —
**not** the `/timing` endpoint's billable-minutes field, which was
unreliable for every run sampled (see "A note on the billing endpoint,"
below). "Billed minutes" below means: for each job in a run, its raw
wall-clock duration, summed across all jobs in that run (GitHub bills per
job, not per run — parallel jobs bill additively) — before GitHub's
per-job rounding-up-to-the-next-minute is applied (§4 A quantifies that
separately, since it multiplies rather than adds to these numbers).

#### `ci.yml`

Sampled 30 most recent completed runs, spanning **2026-08-09T21:59:49Z to
2026-08-10T20:14:34Z (~22.25 hours)** — this is an unusually busy window
(the nightly ticket-executor pipeline was actively cutting and merging
several tickets during it), not necessarily this workflow's typical daily
rate; treat the ~1.3 runs/hour cadence below as a high-activity snapshot,
not a steady-state average.

Two structurally different run shapes, since 5 of the 7 jobs are gated
`if: github.event_name == 'pull_request'`:

- **`pull_request` runs** (all 7 jobs execute) — per-job average real
  duration across 6 sampled successful PR runs:

  | Job | Avg duration |
  |---|---|
  | `pr` (Lint · Typecheck · Test) | 59.5s |
  | `red-check` (Red-Check TDD Enforcement) | 30.0s |
  | `gate-guard` | 13.3s |
  | `report-guard` | 13.0s |
  | `scope-guard` | 12.8s |
  | `actionlint` (Validate workflow files) | 7.8s |
  | `guards` (doc-sync · migration · mockup · impl-notes-health) | ~2.0s* |

  \* `guards` only runs on `pull_request` events same as the other 4
  gated jobs, but its very short average includes some sampled runs where
  the job was present but effectively a no-op pass-through — treat as
  approximate, not as precisely comparable to the other rows.

  Summed: ~138s (~2.3 min) of real per-job compute per PR run.

- **`push` runs** (only `pr` and `actionlint` execute — the other 5 skip
  via their `if` gate) — this is the post-merge re-run item 3 asks about,
  confirmed directly from a real run's job list (`gh api
  repos/AWM-Development/QuestLog/actions/runs/31427673827/jobs`):

  ```
  {"name":"Lint · Typecheck · Test","started_at":"2026-08-10T20:09:58Z","completed_at":"2026-08-10T20:10:59Z","conclusion":"success"}
  {"name":"Validate workflow files","started_at":"2026-08-10T20:09:58Z","completed_at":"2026-08-10T20:10:08Z","conclusion":"success"}
  {"name":"Gate Guard","conclusion":"skipped","runner_name":null}
  {"name":"Scope Guard","conclusion":"skipped","runner_name":null}
  {"name":"Red-Check (TDD Enforcement)","conclusion":"skipped","runner_name":null}
  {"name":"Report Guard","conclusion":"skipped","runner_name":null}
  {"name":"Guards (doc-sync · migration · mockup · impl-notes-health)","conclusion":"skipped","runner_name":null}
  ```

  Summed: ~67s (~1.1 min) of real per-job compute per push run — a
  skipped job costs nothing (GitHub doesn't bill a job whose top-level
  `if` evaluates false), so the push-triggered re-run's real cost is only
  the `pr` job's full lint/typecheck/build/test pass a second time, not
  all 7 jobs again.

  Across the 30-run sample: 15 `pull_request` runs, 15 `push` runs — a
  roughly even split, meaning the post-merge `pr`-job re-run (item 3) is
  firing about as often as the PR-time gate itself.

#### `e2e-release-check.yml`

All 8 available completed runs, spanning **2026-07-16T17:42:35Z to
2026-08-10T19:32:10Z (~25 days)** — sparse by design (`push` to `main`
only, plus occasional `workflow_dispatch`), matching the file's own stated
intent. Single job (`e2e`), avg real duration **0.95 min/run** (n=8, range
0.83–1.13 min). ~8 min of real compute total across the sampled 25-day
window.

#### `smoke-test-dev.yml`

30 most recent completed runs, spanning **2026-08-07T20:31:34Z to
2026-08-10T20:09:55Z (~71.6 hours, ~3 days)** — ~10 runs/day, all
`push`-triggered. Single job (calls the shared `smoke-test.yml`), avg real
duration **0.34 min/run** (n=15 sampled in detail, range 0.05–0.50 min).

**Staleness note, flagged for Alex rather than acted on (out of this
ticket's scope to fix):** this file's own top-of-file comment says "Until
[Fly's dashboard GitHub integration, T-035] is done, `push` alone never
fires." All 30 sampled runs in this window are genuinely `push`-triggered,
which means that integration is now connected and the comment is stale —
worth a follow-up doc fix, not investigated further here since `T-035`
itself isn't in this ticket's Context files.

#### `smoke-test-prod.yml`

All 4 available completed runs, spanning **2026-07-30T16:18:27Z to
2026-08-10T19:32:10Z (~11 days)** — rare by design (`push` to `main`
only, i.e. only on an actual release). Single job, avg real duration
**0.50 min/run** (n=4, range 0.40–0.58 min). Negligible total volume.

#### `ticket-status-ledger.yml`

30 most recent completed runs, spanning **2026-08-07T20:00:03Z to
2026-08-11T00:40:23Z (~76.7 hours, ~3.2 days)** — ~9.4 runs/day,
`pull_request` (`closed`) triggered, gated `if: ...pull_request.merged ==
true` at the job level. Single job when it actually runs, avg real
duration **0.14 min/run** (n=15 sampled, range 0.08–0.28 min) — a
close-without-merge produces a run whose one job is skipped (0 billed),
so this average already reflects only genuine merges. Negligible per-run
cost; the ~9.4/day cadence during this sample reflects an unusually active
ticket-merge window (same pipeline activity noted for `ci.yml` above), not
a typical steady-state rate.

### A note on the billing endpoint

`gh api repos/AWM-Development/QuestLog/actions/runs/<id>/timing` — the
endpoint that's supposed to report actual billed minutes directly —
returned `total_ms: 0` for every run sampled in this audit, including
runs whose jobs clearly ran for 30–95 seconds each per their own
`started_at`/`completed_at` fields:

```
$ gh api repos/AWM-Development/QuestLog/actions/runs/31428050944/timing
{"billable":{"UBUNTU":{"total_ms":0,"jobs":14,"job_runs":[{"job_id":93584383595,"duration_ms":0}, ... ]}},"run_duration_ms":13000}
```

This audit does not know whether that's a genuine reporting lag (GitHub's
billing rollup running behind real-time for a repo this active) or
something about this org/repo's specific billing configuration — outside
this ticket's Scope and Context files to investigate further. Practical
consequence: **all "minutes" figures in §1 above are derived from summed
real per-job wall-clock time, not from GitHub's own billing API**, since
the latter proved unusable for every run this audit checked.

### 2. `ci.yml`'s own job count and where the minutes actually go

7 jobs today (not 9 — see staleness correction above). On a `pull_request`
run, the `pr` job (the actual lint/typecheck/build/test work) is ~59.5s
of the ~138s summed per-job real time — **43%**. The other 6
guard/lint jobs together are **57%** of real per-job time, despite none
of them doing the PR's substantive quality work — they're gate-checking
the PR's shape (gate/scope/report/mockup/doc-sync/migration state), not
running it.

**This ratio understates the actual minutes cost, once GitHub's real
billing mechanic is applied: each job is billed in whole-minute
increments, rounded up, regardless of how short its real duration was.**
None of the 6 guard/lint jobs above take anywhere near a full minute
(7.8s–30.0s each) — but each is billed a minimum of 1 minute. On a
`pull_request` run: 7 jobs × 1 billed minute (worst case, since every
sampled job duration is under 60s) = **up to 7 billed minutes**, against
~2.3 minutes of real compute — **roughly 3x inflation purely from job
count**, not from actual work. This is the single highest-leverage number
in this audit and the basis for finding #1 in the punch list below.

### 3. Redundant/low-value triggers

- **`ci.yml`'s post-merge `push` re-run of the `pr` job** (item 3 above):
  confirmed live — every push to `develop`/`main` re-runs `pr`'s full
  lint/typecheck/build/test a second time, ~15 times in the sampled
  22.25-hour window (roughly 1:1 with `pull_request` runs in the same
  window — see §1 `ci.yml`). The PR that triggered the merge already had
  to pass this identical check to become mergeable in the first place;
  the only scenario where a post-merge re-run catches something a PR-time
  run didn't is a bad merge commit (an actual merge conflict resolution,
  or `develop` moving between PR-approval and merge in a way that breaks
  the merged result) — a real but narrow case. `actionlint` re-running
  post-merge has the same shape and the same argument.
- **Two checkouts per job, most jobs.** `pr`, `gate-guard`, `scope-guard`,
  `report-guard`, and `red-check` each do a bare `actions/checkout@v5`
  step, immediately followed by `uses: ./.github/actions/setup-repo`,
  which does its own `actions/checkout@v5` internally. Each job's own
  comment explains why (a local composite action reference needs the repo
  already checked out to resolve `./.github/actions/...`, and
  `setup-repo`'s own checkout then supersedes the bare one with the real
  ref/fetch-depth) — this is closer to a genuine GitHub Actions mechanical
  constraint than a careless duplication, but it's still real, measurable
  double-checkout cost on 5 of 7 jobs and worth flagging as a possible
  `tighten` target (e.g. a sparse/shallow first checkout scoped to just
  `.github/actions/`) rather than assuming it's free.

### 4. Concrete reduction options, ranked

**A. Consolidate `gate-guard`, `scope-guard`, and `report-guard` into one
job** (`tag: consolidate`) — the highest-leverage, lowest-risk option
found. All three are small, fast (12.8–13.3s real work each), share the
same trigger condition (`if: github.event_name == 'pull_request'`), the
same `setup-repo` preamble, and already follow the exact pattern `guards`
itself used for `doc-sync`/`migration-guard`/`mockup-guard`/
`impl-notes-health` (T-121's precedent). Merging these three from 3 jobs
into 1 removes 2 billed minutes per PR run (rounding-up math from §2) at
zero loss of check coverage — each check just becomes a step instead of a
job, same as `guards`' own internal shape. Estimated savings: **~2 billed
minutes/PR run**, i.e. roughly 15 runs/day (per this audit's sampled
cadence) × 2 min ≈ **~30 billed minutes/day** during an active period —
scales down proportionally on quieter days, but the per-run savings ratio
holds regardless of volume.

**B. Drop the post-merge `push`-triggered `pr`/`actionlint` re-run on
`develop`** (`tag: consolidate`, flagged as a tradeoff, not a clear win —
Alex's call, same caveat T-117 finding #11 used for its own tradeoff
item). Removing `push` entirely from `ci.yml`'s `on:` block (or scoping
it to `main` only, matching this repo's "main is deploy-only" branch
model) would save the full ~1.1 min/run this audit measured, at the cost
of losing the narrow "bad merge commit" signal §3 describes. Given
`ticket-status-ledger.yml` already fires on every `develop` merge and
would remain a natural place to add a lightweight post-merge sanity check
later if this signal turns out to matter in practice, this is a real
option, not just a theoretical one — but it's a behavior change, not a
pure removal, so ranked below option A.

**C. Investigate the double-checkout pattern (§3) for a cheaper first
checkout** (`tag: tighten`) — lowest priority of the three; each bare
checkout is fast (checkout time isn't broken out separately in the
per-job durations above, since it's a step within a job, not a
separately-billed unit) and the fix (e.g. `sparse-checkout:
.github/actions`) adds its own complexity for a saving that's likely
sub-second per job. Worth a look only if A and B are both adopted and
still leave headroom to chase.

**D. `smoke-test-dev.yml`'s stale "T-035 not connected" comment**
(`tag: tighten`, doc-only, not a minutes finding) — see §1's staleness
note. Doesn't move the needle on Actions minutes; flagged here only
because it was found live during this audit and belongs with the other
staleness corrections rather than being silently dropped.

### 5. Summary punch list

| # | Item | Tag |
|---|------|-----|
| 1 | `ci.yml`'s `gate-guard`/`scope-guard`/`report-guard` are 3 separate jobs where 1 would do — each is billed a minimum 1 minute regardless of real (~13s) duration | consolidate |
| 2 | `ci.yml`'s `push`-triggered re-run of `pr`/`actionlint` on `develop`/`main` duplicates PR-time work, ~1:1 with `pull_request` runs in this audit's sample | consolidate (tradeoff — Alex's call) |
| 3 | 5 of `ci.yml`'s 7 jobs do a bare `actions/checkout@v5` immediately followed by `setup-repo`'s own internal checkout | tighten |
| 4 | `smoke-test-dev.yml`'s top-of-file comment says `push` "never fires" until T-035 connects Fly's dashboard — live data shows it already does | tighten |
| 5 | `ci.yml` job count is 7 today (not 9) — T-121 already consolidated the 4 former guard jobs into `guards` | keep (already fixed, noted for record) |
| 6 | `e2e-release-check.yml`, `smoke-test-prod.yml` volumes are both low and match documented trigger design (release-gated, not per-PR) | keep |
| 7 | `ticket-status-ledger.yml` per-run cost is negligible (~0.14 min) even at ~9.4 runs/day observed cadence | keep |
| 8 | GitHub's `/timing` billing-minutes API returned `total_ms: 0` for every run sampled — not usable as a data source for this or future audits | tighten (flagged for follow-up investigation, not a workflow-file change) |

---

## Test evidence

```
$ scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (836 passed)
```

No application code touched by this ticket — this is the standard
repo-wide regression baseline, run once (S-tier docs-only path,
`EXECUTOR_ROUTINE.md` Step 4's S-docs-only branch).

## Exit condition check

- `git diff`/`git status` shows zero changes under `.github/workflows/` —
  confirmed; this ticket's diff is additive-only (this report file plus
  the standard wrap-up files: milestone checkbox, CHANGELOG entry).
- This file exists at `Docs/tickets/reports/T-128-ci-actions-minutes-audit.md`
  and names all five workflow files by filename at least once each — see
  the Audit's §1, each workflow gets its own subsection headed by its
  filename (`ci.yml`, `e2e-release-check.yml`, `smoke-test-dev.yml`,
  `smoke-test-prod.yml`, `ticket-status-ledger.yml`).
- Real run-duration data pulled from GitHub (`gh api .../actions/runs`,
  `gh api .../actions/runs/<id>/jobs`) is included as evidence, not
  YAML-only step-counting — see §1's pasted job-list excerpt and the
  billing-endpoint note's pasted `gh api .../timing` output.
- Every finding in the summary punch list (§5) is tagged with exactly one
  of `keep | consolidate | remove | tighten`.
- All tests green, typecheck clean, lint clean — see Test evidence above;
  no application code touched.

## Reviewer verdict

N/A — S-tier, docs/config-only Scope (`EXECUTOR_ROUTINE.md` Step 5's
S-docs-only branch skips the `reviewer` subagent for the same reason
`XS`/`D` tiers do); independent verification deferred to Alex's manual
`/morning-review`.

## Efficiency notes

Ran the full narrow-fallback pre-flight (Step 1) before picking this
ticket — two P1-tier candidates ahead of it in priority order (`T-039`,
`T-040`) turned out to be interactive-only ("NOT ELIGIBLE FOR AUTONOMOUS
NIGHTLY EXECUTION") tickets, so the loop fell through to `T-128` (also
P1, next by numeric tiebreak) before finding an actionable pick — a
correct skip by ticket-body inspection, not a failed attempt.

Most of this ticket's real cost was `gh api` round-trips: per-workflow
run lists plus per-run job-detail calls (5 workflows × up to 15 runs each
sampled in detail) to get real job-level `started_at`/`completed_at`
timestamps, after the `/timing` billing endpoint turned out to be
unusable (returned `total_ms: 0` for every run checked — a real finding
in its own right, not just friction; see the Audit's "A note on the
billing endpoint"). Two backlog-promotion and worktree-reap checks (Step
1) added a small amount of overhead ahead of ticket selection but found
nothing actionable (no backlog ticket's `Blocked on:` list was fully
cleared; one stale worktree, `T-124`, was reaped after confirming its PR
had merged).

**Retry log:** 0 retries. This ticket has no Red/Green implementation
loop (S-tier, docs-only Scope) — the retry-log categories don't apply.

## Anything Alex must decide

- **Whether to act on any of §5's `consolidate`/`tighten` findings.**
  This ticket is recommendations-only by design. Item #1 (consolidating
  `gate-guard`/`scope-guard`/`report-guard`) is the one I'd flag as
  highest-leverage: ~2 billed minutes saved per PR run at zero coverage
  loss, following T-121's own precedent almost exactly.
- **Item #2 (dropping `ci.yml`'s post-merge `push` re-run) is a real
  tradeoff, not a clear win** — flagging for Alex's call rather than
  recommending outright, same as T-117's own finding #11 handled a
  similar serial-vs-parallel tradeoff.
- **The `/timing` API's `total_ms: 0` result** (Audit, "A note on the
  billing endpoint") is worth a second look if Actions-minutes overage
  recurs — either GitHub's billing rollup lags real-time by more than
  this audit's freshest sampled runs would cover, or something about this
  org/repo's billing configuration makes that endpoint structurally
  unreliable here. Outside this ticket's Scope/Context files to
  investigate further — flagging as a possible follow-up rather than
  guessing.
- **`smoke-test-dev.yml`'s stale top-of-file comment** (punch list #4)
  is a one-line doc fix, not a minutes finding — mentioning it here since
  it was found live during this audit's data pull and Out of scope
  explicitly excludes touching `.github/workflows/` in this ticket.
