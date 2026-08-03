# G-020 — Pipeline audit & improvement: runner-agnosticism, machine-enforced process, and the tooling surface around it

Gate type: 🧠 strategy

Milestone ref: none yet — like `G-012`, this gate's resolution is what opens
  the milestone(s), rather than unblocking an existing task. `M-PIPELINE`
  (`Docs/milestones/MILESTONES_V1_1_MCP.md`) is the closest existing home
  and its `Goal` line ("make the ticket pipeline safe to run several agents
  against at once") is the direct predecessor of Q1 below; `M-AUDIT.1`
  (`T-017`) is the closest existing *audit* vehicle but is scoped to
  application architecture, not to the pipeline that builds it. Part of
  this gate's resolution is deciding which of those two this extends, or
  whether it opens a successor milestone doc of its own.

Opened: 2026-08-02 — by Alex, during an investigation session run in Devin
  (https://app.devin.ai/sessions/87895690da174c3eabf369163e9dcb66) that
  started as "can Devin run this pipeline" and turned up enough
  runner-coupling and enforcement gaps to be worth a decision rather than a
  ticket. Findings from that session are recorded under Notes so `/ungate`
  doesn't have to re-derive them.

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md (the routine itself — Step 0's
    fetch-only bootstrap and Step 1's dedup classification are the two
    places runner-neutrality is already accidentally correct)
  - Docs/tickets/COMMANDS.md and .claude/commands/ (the command surface
    whose portability Q1 is about)
  - .claude/hooks/session-start.sh, .claude/hooks/stop-usage-capture.sh,
    scripts/worktree-postgres-env.sh (all three derive isolation from
    `CLAUDE_PROJECT_DIR` — the single concrete coupling point, see Notes)
  - packages/core/src/observability/capture-usage.ts,
    packages/core/src/observability/pricing.ts (transcript + per-token
    cost model — the component with no runner-neutral equivalent)
  - packages/observability/src/schema/tables.ts (`ticket_runs`, where a
    provider/runner dimension would have to land; already carries nullable
    placeholder columns for not-yet-shipped fields, the established
    pattern for this kind of additive change)
  - Docs/milestones/MILESTONES_V1_1_MCP.md §M-PIPELINE, §M-AUDIT
  - Docs/milestones/MILESTONES_V1_2_MCP.md §M-OBS (the cost/efficiency
    programme Q1's observability half would amend)
  - .github/workflows/ci.yml and .github/pull_request_template.md (the
    enforcement surface Q2 is about, and the template Q3 flags as drifted)
  - CLAUDE.md (hard rules — the "written instruction" half of Q2)

Open question: Should this pipeline commit to being **runner-agnostic and
  machine-enforced** — portable across Claude Code, Devin (CLI or cloud),
  or any successor agent, with its process rules verified by CI rather
  than trusted from the agent's own report — or does it stay
  Claude-Code-native and instruction-enforced, treating that coupling as
  an acceptable cost? And whichever way that lands, what does an at-large
  audit of the current system cover, and which adjacent tools become
  milestones of their own? Five sub-decisions, each of which changes what
  gets built:

  **Q1 — Runner agnosticism, and how far.** Three concrete couplings exist
  today (Notes §1–3). Fixing the isolation one is three lines; the
  observability one is a schema change plus an adapter and cannot be done
  ad hoc without corrupting the v1.2 cost series. Decide: (a) is
  portability an explicit design goal of the pipeline, or an incidental
  property we stop claiming? (b) does `TICKET_SPEC.md`'s `Model: sonnet`
  field generalise to a runner+model selection, or stay as-is? (c) does
  `EXECUTOR_ROUTINE.md` grow a short "Runners" section naming which steps
  are runner-specific, or do we fork the routine per runner (strongly
  disprefer, but name it as the rejected alternative)?

  **Q2 — Instruction → invariant.** Which of the routine's rules become
  machine-checked, and where does the check live? The candidate set, in
  rough order of value per line of code: a gate guard (fail any ticket PR
  whose ticket carries an unresolved `Gated on:`, or whose `Blocked on:`
  prerequisites aren't in `done/`); report-completeness validation against
  `REPORT_TEMPLATE.md` (no placeholder text, required sections present,
  test-evidence block contains real runner output); recomputation of the
  report's own claims (diff size, files changed, exit-condition greps
  computed by CI rather than trusted from the agent); a scope guard (diff
  confined to the ticket's declared `Context files:` paths, `Docs/mockups/`
  untouched, base is `develop`); and a red-check job (run the PR's new
  tests against `develop`'s implementation and require them to fail — TDD
  as a CI job rather than a written rule). Decide which of these are worth
  building, whether they're required status checks on `develop`, and
  whether the same logic also runs as a pre-flight so a run fails early
  rather than at PR time.

  **Q3 — The audit itself.** What is in scope for a full audit of the
  pipeline as a system — not the application, which is `T-017` — and what
  do we compare it against? Known drift is already listed in Notes §4; the
  open part is whether the comparison set is a one-off written report
  (same shape as `T-038`'s security review) or a standing practice, and
  which external systems count as the gold standard to measure against
  (the `AGENTS.md` convention, Claude Code's own skills/hooks conventions,
  Devin's playbooks/automations model, spec-driven harnesses of the
  spec-kit family, and whatever else is worth reading by then).

  **Q4 — Surface expansion, as future milestones.** Which adjacent tools
  earn a milestone, in what order, and which ones threaten the invariant
  that the repository is the source of truth? Candidates raised: a second
  runner as a parallel execution lane (Devin cloud fan-out, one machine per
  ticket — the claim-push mutex already makes it safe); Slack (delivery of
  `/lineup`, blocked-run alerts, and possibly `/ungate` prompts — not
  currently installed anywhere); an external ticket tracker (Linear/Jira —
  and if so, is it a *mirror* of `Docs/tickets/` or does it displace the
  files as canonical, which would be a reversal of the pipeline's central
  design choice); automated review bots as a second opinion alongside the
  `reviewer` subagent; and CI-event-driven triggers (merge into `develop`
  re-runs the promotion sweep, CI red opens a fix session) to complement
  the time-based scheduler.

  **Q5 — Sequencing and ownership.** Does the outcome extend `M-PIPELINE`
  in v1.1, extend `M-AUDIT`, or open a new milestone doc? How does it
  interact with the already-queued pipeline work it overlaps — `T-084`
  (process weight by complexity tier), `T-095` (observability ingestion
  wiring, which touches the same Step 6/7 the runner question does), and
  `T-073` (id-allocation claim step)? Anything Q1/Q2 changes about Step
  6/7 should land with `T-095` rather than after it.

Blocks: none yet — no ticket drafted. Scope can't honestly be written for
  any of Q1–Q4 before the decision: Q1 changes whether an adapter is built
  at all, Q2's candidate list is a menu rather than a spec, and Q4 is
  explicitly a prioritisation question. `T-084`, `T-095` and `T-073` are
  adjacent but **not** gated on this — none of them carries a `Gated on:`
  line and none should acquire one; they are listed here only so
  `/ungate` sequences against them (Q5).

Notes: Findings from the 2026-08-02 investigation session, recorded so the
  `/ungate` session starts from evidence rather than re-deriving it.

  **1. The routine is already portable, by accident of good design.** The
  scheduler bootstrap (`git fetch origin develop && git show
  origin/develop:Docs/tickets/EXECUTOR_ROUTINE.md`, then "follow it
  exactly") makes the routine *data*, not harness configuration — any
  agent that can read markdown and run `git`/`gh` can execute it. This was
  demonstrated, not assumed: `/lineup`'s procedure was run end-to-end from
  a non-Claude agent with no repo changes, and produced a correct lineup
  (At Bat `T-082`, On Deck `T-084`, In the Hole `T-095`, both open PRs
  identified) including the Step 1 dedup classification. Skills were
  likewise picked up unmodified — `.claude/skills/*/SKILL.md` is a
  cross-tool convention now, not a Claude-specific path.

  **2. The one real coupling is `CLAUDE_PROJECT_DIR`, and its failure mode
  is silent, not loud.** `scripts/worktree-postgres-env.sh:7` hard-requires
  it and derives `WORKTREE_NAME` → `QUESTLOG_PG_PORT` /
  `COMPOSE_PROJECT_NAME` from it; `.claude/hooks/session-start.sh:54`
  pattern-matches the same variable against `*/tmp/worktrees/*` to decide
  worktree-vs-primary. Under a runner that doesn't export it, both hooks
  first die on `set -u` at their `cd` line — but the dangerous case is the
  *partial* fix: repair only the `cd` and the worktree branch is never
  taken, so every concurrent agent derives the same port and the same
  compose project, and two runs quietly share one Postgres and one set of
  test databases. That is the `T-071`/`T-072`/`T-099` collision class
  reintroduced through the back door. `: "${CLAUDE_PROJECT_DIR:=$(git
  rev-parse --show-toplevel)}"` makes the derivation runner-neutral and is
  a no-op under Claude Code. Cheap enough to do regardless of how Q1
  lands, but it is a decision about intent, not a bug fix, which is why
  it's here rather than in a ticket.

  **3. Usage capture is the only component with no runner-neutral
  equivalent.** `capture-usage.ts` resolves its input from
  `CLAUDE_CODE_SESSION_ID` plus `~/.claude/projects/**/<session>.jsonl`,
  and `pricing.ts` prices Claude tokens. Other runners expose
  session-level cost in their own unit (Devin: ACUs) with no transcript
  and no token/cache breakdown, so `turns_to_green`, `human_message_count`
  and the reviewer-subagent split have no direct analogue. Mixing units
  into one `ticket_runs` series would silently corrupt the very thing
  `M-OBS` exists to measure; the honest options are a `runner` dimension
  with per-runner views, or accepting that only Claude-run tickets carry
  cost data. `T-051`'s human-hour-equivalent model is runner-neutral and
  survives either way.

  **4. Drift found in passing, all pre-existing and none Devin-specific.**
  (a) `.claude/commands/lineup.md:15` still specifies the per-candidate
  `gh pr list --search "T-### in:title"` check that `EXECUTOR_ROUTINE.md`
  Step 1 replaced with fully-paginated branch matching (title matching
  false-positives on ticket-filing PRs). (b) `EXECUTOR_ROUTINE.md` Step 7
  posts the morning report as the PR body while
  `.github/pull_request_template.md` supplies a long checklist — they
  conflict today and nothing says which wins. (c) That template's footer
  points at a `/code-review` skill that does not exist in
  `.claude/commands/` or `.claude/skills/`. Each is a one-line fix; they
  are noted here rather than fixed piecemeal because Q3 is partly about
  whether anything *systematically* catches this class (`/command-help`'s
  cross-check covers the command table only).

  **5. Provenance for Q2's framing.** The enforcement question is Alex's,
  from direct experience: an earlier attempt to run this pipeline under a
  different agent produced truncated reports, cut corners, and skipped the
  strategy-review stops the routine requires. The working conclusion — to
  be confirmed or rejected in the `/ungate` session, not assumed — is that
  this is not a property of any particular agent's autonomy level but of
  which rules are *checkable*: an agent that will cut corners on process
  will cut them in code, and the parts of this pipeline that have held up
  under autonomous execution are precisely the ones with machine-checkable
  exit conditions. If that holds, enforcement work is worth doing on its
  own merits and independently of Q1's outcome.

## Resolution (2026-08-02)

Resolved with Alex, out of numeric order (this gate was worked ahead of the
still-open `G-013`/`G-017` — a deliberate one-time deviation from
`/ungate`'s "always earliest" rule, at Alex's explicit direction, not a
change to that rule going forward).

**Comparison set (Q3).** Three reference points, researched live in this
session: (1) **spec-driven development / GitHub's `spec-kit`** — the
converged industry shape is `Specify → Plan → Tasks → Implement`, with an
`AGENTS.md` "constitution" at the repo root (a cross-tool convention, not a
single vendor's), and EARS-syntax acceptance criteria ("WHEN X, the system
SHALL Y"). QuestLog's ticket format is a collapsed version of the same idea
— one file carries spec+plan+tasks — and its `Exit condition:` field is
already EARS-adjacent in spirit, if not syntax. (2) **Devin's playbooks +
cloud fan-out** — reusable prompt templates for recurring job shapes, and
multiple parallel cloud sessions per repo rather than one sequential runner;
Cognition reports ~75% unsupervised completion on SWE-bench-style tasks.
(3) **Machine-enforced agent policy** — the 2026 multi-agent governance
literature has converged on not trusting an agent's own report of what it
did, verifying invariants in CI/at the platform layer instead. This is a
one-off written report (same shape as `T-038`'s security review), recorded
here rather than as a separate doc — no standing-practice mechanism is
being built now; revisit only if a recurring need for re-running this
comparison shows up.

**Where QuestLog already exceeds the comparison set:** the observability
system (`M-OBS`) — per-ticket dollar cost broken down by cache-write/read
tier, complexity-tier normalization, a reviewer-subagent cost split,
human-hour-equivalent modeling — is more granular than anything found
published in the spec-kit or Devin ecosystems. The gate/ticket split
(routine work vs. 🎨/🧠 decisions, each with its own durable, auditable
lifecycle) is cleaner than spec-kit's single transient `clarify` step.

**Where it's behind, and this gate's actual resolution:**

- **Q1 (portability) — full commitment.** `AGENTS.md` becomes the canonical
  constitution (`T-105`); the one real runner coupling
  (`CLAUDE_PROJECT_DIR`, Notes §2) gets a safe default (`T-104`);
  `EXECUTOR_ROUTINE.md` grows a "Runners" section rather than forking per
  runner (`T-106`, Q1(c)); `TICKET_SPEC.md`'s `Model:` field generalizes to
  `Runner:` + `Model:` (`T-107`, Q1(b)); the observability store gains a
  `runner` dimension (`T-108`) and a `RunnerCostAdapter` interface
  (`T-109`) — the harder half Notes §3 flagged, done now rather than
  deferred, per Alex's "full commitment" call.
- **Q2 (instruction → invariant) — build the full candidate set.** All five
  candidates from the Open question section get tickets: gate guard
  (`T-110`, `P0` — cheapest and highest-value, directly the failure mode
  that opened this gate), scope guard (`T-111`), report-completeness
  validation (`T-112`), exit-condition evidence recomputation (`T-113` —
  scoped to not duplicate the already-queued `T-055`'s diff-stat sync), and
  the red-check TDD-as-CI-job (`T-114`, explicitly the most novel/highest-risk
  candidate, scoped conservatively). All become required status checks on
  `develop`; `T-115` (blocked on all five) wires the same logic into the
  executor's own pre-flight so a run fails fast locally rather than only at
  PR time — the red-check is deliberately excluded from pre-flight, since
  it needs a completed diff to run against. Alex's framing: don't treat
  this as "pick the top 1-2," build the backlog now so the micro-ticket
  pipeline can iterate on it over time regardless of what gets prioritized
  first.
- **Q4 (surface expansion) — all five candidates logged as roadmap, none
  ticketed yet.** Second runner as a parallel execution lane, Slack
  delivery, an external tracker as a mirror (never a replacement for
  `Docs/tickets/` as canonical), automated review bots alongside the
  `reviewer` subagent, and CI-event-driven triggers. Recorded in
  `MILESTONES_V1_1_MCP.md`'s M-PIPELINE "Future candidates" note rather than
  drafted — Alex's call was to put all five on record, not narrow to a
  subset now.
- **Q5 (sequencing/ownership) — extends `M-PIPELINE` in `MILESTONES_V1_1_MCP.md`**
  (M-PIPELINE.8–19), not a new milestone doc — confirmed explicitly with
  Alex after an initial round of drafting, since M-PIPELINE only exists in
  that file and "extend M-PIPELINE" necessarily means editing it there.
  Drift found in Notes §4 (`lineup.md`'s stale search, the PR-template/
  routine conflict, the dead `/code-review` reference) is **not** separately
  ticketed here — each is a one-line fix better caught by whatever Q2
  enforcement job would have caught it going forward (the doc-sync-style
  guards), rather than three throwaway tickets; flagged here so it isn't
  lost, and low-cost enough for anyone to fix opportunistically.

**Letter grade on the pipeline as it stands (Alex's ask, not part of the
formal Q1–Q5 decision, recorded here for the record):** **B+.** Strong
engineering craftsmanship — TDD discipline, real concurrency safety
(worktree isolation + claim-by-push mutex), and observability more granular
than the public comparison set. Held back a full grade from A-/A by exactly
this gate's Q2 finding: every rule in the routine is enforced by the agent
choosing to follow prose, not verified by CI — the specific gap the 2026
governance literature treats as load-bearing for autonomous pipelines.
Expected to move to A-/A once the Q2 tickets land, since the underlying
design was already sound; it just wasn't checked.
