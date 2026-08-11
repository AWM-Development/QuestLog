# G-028 — Automated review bots as a second opinion alongside the `reviewer` subagent

Gate type: 🧠 strategy

Milestone ref: M-ROBUST.3 (`Docs/milestones/MILESTONES_V1_5_MCP.md`)

Opened: 2026-08-02 — by Alex, filed as part of `G-020`'s Q4 follow-through.

Context files (load ONLY these):
  - Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Resolution (Q4)
  - .claude/agents/reviewer.md (what a second opinion would sit alongside)
  - Docs/tickets/EXECUTOR_ROUTINE.md § Step 5
  - Docs/tickets/queue/T-114-ci-red-check-job.md (the CI-side check this
    gate's resolution should sequence against — see Notes)

Open question: Should a second, independent reviewer run alongside the
  existing `reviewer` subagent? If yes: does it gate the same
  PASS/PASS-WITH-NOTES/FAIL decision (requiring both to agree before
  Step 7 proceeds), or run advisory-only (comments, no merge-gating power);
  which product/mechanism (a hosted GitHub-App code-review bot, vs. a
  second in-repo subagent deliberately given a different prompt/model);
  and what's the added token/dollar cost against a single reviewer's
  existing spend, weighed against `M-OBS`'s own cost-consciousness?

Blocks: none yet — M-ROBUST.3 not yet drafted.

Notes: Raised in `G-020` Q4 verbatim: "automated review bots as a second
  opinion alongside the `reviewer` subagent." No specific tool named yet —
  resolving this gate should name one, or explicitly decide against any
  specific tool in favor of a second in-repo subagent. Worth sequencing
  after `T-114` (the red-check CI job) lands: `reviewer.md`'s own framing
  is that it exists to judge what CI can't check, so a second opinion's
  marginal value is clearest once CI already covers the mechanical
  invariants `G-020`'s Q2 tickets are adding.

## Resolution (2026-08-10)

**No second reviewer — won't-fix.** `T-114` (the red-check CI job) has
since shipped (`Docs/tickets/done/T-114-ci-red-check-job.md`), so the
sequencing condition this gate's own Notes named is satisfied: CI now
enforces the mechanical invariant (a PR's new tests must actually fail
against pre-change `develop`) that a second reviewer would otherwise have
been the only thing catching. Combined with the existing single-reviewer
CI/`reviewer`-subagent split (CI = mechanical, `reviewer` = judgment),
Alex judged a second opinion — hosted bot or second in-repo subagent,
advisory or gating — as added token/dollar cost without a clear gap left
to close for a solo-dev pipeline with no second reviewer's institutional
knowledge to diverge from. No product/mechanism was evaluated since the
answer to the gating open question is no regardless of mechanism.

Re-open a fresh gate if a concrete gap surfaces later (e.g. the `reviewer`
subagent's own judgment-layer checks start missing something in practice)
rather than reviving this one — the reasoning here is tied to the current
single-reviewer pipeline shape, not a permanent verdict.

No tickets to draft or promote — `Blocks:` was "none yet" and stays that
way; `M-ROBUST.3` is not being drafted as a result of this resolution.
