# QuestLog — v1.2 Milestones (Executor Observability & Efficiency)

**Location:** `Docs/MILESTONES_V1_2_MCP.md`
**Status:** CANONICAL task source for v1.2, supplementing `Docs/MILESTONES_V1_1_MCP.md` (v1.1 — in progress, kept as the task source for M-REMOTE/M-CICD/M-AUDIT; v1.1's own "only task source" line now points here for anything past M-AUDIT).
**Created:** 2026-07-25, during a planning session auditing whether the "narrow ticket" discipline the whole executor pipeline depends on was actually working.

## Why v1.2 exists

That planning session set out to answer a simple question — is the nightly executor's ticket discipline actually keeping runs small, or is it just felt discipline? — and ran into a harder one underneath it: Anthropic exposes no per-run token-usage API on Alex's plan, not to Alex, and not to the executor about itself. The only real signal available (PR diff size via `gh pr list`) is a proxy, not the thing itself, and it says nothing about *why* a run was large — scope creep, superfluous context, pre-existing code needing a fix first, or genuine irreducible complexity all look the same in a diff.

This milestone builds the actual instrumentation instead of continuing to guess: the executor's own transcript is ground truth for token usage (that's what Claude Code already logs), so a hook can capture it; the executor itself is the only thing that knows *why* a run took its shape, so its own report can capture that. Framed by Alex explicitly: this project is also a portfolio piece demonstrating a lean, disciplined automated-codegen pipeline, and metered pricing for AI coding platforms looks like where this is all headed — a system that can't measure its own token efficiency isn't a credible example of one that's optimized for it. v1.2 is that measurement system, plus a first pass at closing some of the waste it's likely to reveal.

**Resolved gates going into this milestone:** none — this milestone opens two (`G-003`, `G-004`), it doesn't inherit any resolved ones.

**Open gates:** `G-003` (`Docs/tickets/gated/G-003-observability-data-storage-location.md`) — where usage/efficiency data is persisted long-term, blocking M-OBS.3 and M-OBS.4. `G-004` (`Docs/tickets/gated/G-004-observability-dashboard-design.md`) — the dashboard's visual design/IA, blocking M-OBS.5.

---

## Milestone M-OBS: Executor Observability & Efficiency Tracking — 🎯 PRIMARY v1.2 MILESTONE

**Goal:** instrument the nightly executor pipeline itself — real token usage, theoretical metered cost, wall-clock duration, and the executor's own qualitative account of why a run ran long or stayed tight — so the ticket-discipline this whole pipeline depends on can be measured and tuned instead of guessed at, and so this system reads as a genuine, data-backed case for lean automated AI code-gen rather than an assumed one.

**Context:** No PRD section covers this — it's new scope discovered during the planning session described above. See that conversation for the full reasoning, including why every Anthropic-side API for this data was ruled out first.

### Tasks

- [ ] **M-OBS.1 — Executor usage-capture hook** (T-046)
  A Claude Code `Stop` hook that parses the run's own JSONL transcript (the only ground truth for token usage available on this account) and writes a per-run artifact — tokens, theoretical cost at current Sonnet 5 rates, duration, turn count — tagged by ticket id or `empty_run: true` for no-ticket-queued runs.
  Exit: a simulated hook invocation against a fixture transcript produces the expected `*.usage.json` shape, including the empty-run case.

- [ ] **M-OBS.2 — Efficiency-notes reporting convention** (T-047)
  A required "Efficiency notes" section in `REPORT_TEMPLATE.md`/`BLOCKED_TEMPLATE.md` where the executor self-reports *why* a run ran long or tight (e.g. superfluous context, pre-existing code needing a fix before the real work could start) — the qualitative half T-046's objective data can't provide on its own.
  Exit: both templates carry the new section; `EXECUTOR_ROUTINE.md` explicitly instructs writing it.

- [ ] **M-OBS.3 — Persist usage/efficiency data to a queryable store** (Gated on: G-003)
  Ingest T-046's per-run JSON artifacts (and T-047's notes) into a real, queryable store so trends can be computed over many runs instead of by hand. **Blocked on deciding where** — new tables in the existing `packages/core`/Neon schema, or a fully separate store — see `Docs/tickets/gated/G-003-observability-data-storage-location.md`.

- [ ] **M-OBS.4 — API endpoint(s) serving usage/efficiency data** (Gated on: G-003)
  Read path for whatever M-OBS.3 lands on — per-ticket and aggregate views (tokens, cost, duration, diff-size correlation, efficiency notes). Shape depends on G-003's resolution, same as M-OBS.3.

- [ ] **M-OBS.5 — Observability dashboard UI** (Gated on: G-004)
  A standalone dashboard (explicitly outside the v1 SourcesPage-only web surface — see `CLAUDE.md`) surfacing M-OBS.4's data: trends per ticket, cost, duration, diff-size correlation, and the qualitative efficiency notes. **Blocked on a design decision** — "designed with Claude design" was named as intent, not a concrete IA/visual answer — see `Docs/tickets/gated/G-004-observability-dashboard-design.md`.

---

## Milestone M-EFFICIENCY: Executor Token Efficiency

**Goal:** reduce the executor's own token spend at the source, not just measure it — the first two, most obviously wasteful patterns identified while auditing real runs: full test-command output re-injected into context on every intermediate TDD iteration, and sequential single-file reads where the full file list is already known up front.

**Context:** No PRD section covers this — same planning session as M-OBS, but a distinct concern (cutting waste vs. measuring it), kept as its own milestone rather than folded into M-OBS's task list.

### Tasks

- [ ] **M-EFFICIENCY.1 — Filter test-command output in the TDD loop** (T-048)
  `pnpm lint && pnpm typecheck && pnpm test` currently returns its full stdout to the model on every call, including the many intermediate passing runs a TDD loop produces before the ticket is actually done. A wrapper script captures full output to a log file always, but only prints a pass/fail summary line per stage to the tool result on success — full output still prints (and is still available in the log) on failure, where it's actually needed to fix something, and the log remains readable at report-writing time so `REPORT_TEMPLATE.md`'s "paste actual output, not a summary" requirement for the *final* passing run is unaffected.
  Exit: a script invocation with a passing test suite prints only a summary line and exits 0; one with a failing suite prints the full failure output for the failing stage(s) and exits non-zero; the full output is byte-identical between the log file and what the unwrapped commands would have printed.

- [ ] **M-EFFICIENCY.2 — Batch ticket context-file reads into one turn** (T-049)
  `EXECUTOR_ROUTINE.md` Step 3 currently has no instruction against reading a ticket's `Context files:` one at a time across multiple assistant turns — each additional turn re-sends the entire growing conversation history (the dominant cost driver identified in the planning session's real-run audit: ~98% of total tokens in a sampled run were cache-read overhead from repeated context resends). Where the full file list is already known up front (every ticket's `Context files:` field, by construction), instruct the executor to issue all of those `Read` calls as parallel tool calls within a single assistant turn instead.
  Exit: `EXECUTOR_ROUTINE.md` Step 3 explicitly instructs single-turn parallel reads for the ticket's known Context files list.

### Ordering constraint

M-OBS.1 and M-OBS.2 have no dependency on each other or on anything else in this doc and can ship immediately. M-OBS.3 and M-OBS.4 wait on `G-003`; M-OBS.4 additionally depends on M-OBS.3's code once it ships. M-OBS.5 waits on `G-004` and on M-OBS.4's code once it exists. M-EFFICIENCY.1 and M-EFFICIENCY.2 have no dependency on each other, on M-OBS, or on anything in `MILESTONES_V1_1_MCP.md`, and can both ship immediately alongside M-OBS.1/M-OBS.2.
