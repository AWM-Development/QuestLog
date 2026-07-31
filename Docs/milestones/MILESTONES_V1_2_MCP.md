# QuestLog — v1.2 Milestones (Executor Observability & Efficiency)

**Location:** `Docs/milestones/MILESTONES_V1_2_MCP.md`
**Status:** CANONICAL task source for v1.2, supplementing `Docs/milestones/MILESTONES_V1_1_MCP.md` (v1.1 — in progress, kept as the task source for M-REMOTE/M-CICD/M-AUDIT; v1.1's own "only task source" line now points here for anything past M-AUDIT).
**Created:** 2026-07-25, during a planning session auditing whether the "narrow ticket" discipline the whole executor pipeline depends on was actually working.

## Why v1.2 exists

That planning session set out to answer a simple question — is the nightly executor's ticket discipline actually keeping runs small, or is it just felt discipline? — and ran into a harder one underneath it: Anthropic exposes no per-run token-usage API on Alex's plan, not to Alex, and not to the executor about itself. The only real signal available (PR diff size via `gh pr list`) is a proxy, not the thing itself, and it says nothing about *why* a run was large — scope creep, superfluous context, pre-existing code needing a fix first, or genuine irreducible complexity all look the same in a diff.

This milestone builds the actual instrumentation instead of continuing to guess: the executor's own transcript is ground truth for token usage (that's what Claude Code already logs), so a hook can capture it; the executor itself is the only thing that knows *why* a run took its shape, so its own report can capture that. Framed by Alex explicitly: this project is also a portfolio piece demonstrating a lean, disciplined automated-codegen pipeline, and metered pricing for AI coding platforms looks like where this is all headed — a system that can't measure its own token efficiency isn't a credible example of one that's optimized for it. v1.2 is that measurement system, plus a first pass at closing some of the waste it's likely to reveal.

**Resolved gates going into this milestone:** none — this milestone opens two (`G-003`, `G-004`), it doesn't inherit any resolved ones.

**Resolved:** `G-003` (`Docs/tickets/gated/resolved/G-003-observability-data-storage-location.md`) — separate Neon branch, own schema/migrations, packaged (`packages/observability`) to be extractable later; not folded into `packages/core`. Ticketed as T-053/T-054/T-055.

**Resolved:** `G-004` (`Docs/tickets/gated/resolved/G-004-observability-dashboard-design.md`) — separate routes for Trends/Log (not tabs, and not three routes — Methodology was cut during mockup review and replaced with comment threads on Log entries); Trends holds both aggregate and per-ticket drill-down. Mockup at `Docs/mockups/observability-dashboard/`. Ticketed as T-057/T-058/T-059.

**Open gates:** none.

---

## Milestone M-OBS: Executor Observability & Efficiency Tracking — 🎯 PRIMARY v1.2 MILESTONE

**Goal:** instrument the nightly executor pipeline itself — real token usage, theoretical metered cost, wall-clock duration, and the executor's own qualitative account of why a run ran long or stayed tight — so the ticket-discipline this whole pipeline depends on can be measured and tuned instead of guessed at, and so this system reads as a genuine, data-backed case for lean automated AI code-gen rather than an assumed one. The dashboard is explicitly a "one stop shop": trend metrics **and** a browsable log of each ticket's morning/blocked report, doubling as Alex's daily review surface for what the executor did the night before.

**Context:** No PRD section covers this — it's new scope discovered during the planning session described above. See that conversation for the full reasoning, including why every Anthropic-side API for this data was ruled out first.

### Tasks

- [x] **M-OBS.1 — Executor usage-capture hook** (T-046)
  A Claude Code `Stop` hook that parses the run's own JSONL transcript (the only ground truth for token usage available on this account) and writes a per-run artifact — tokens, theoretical cost at current Sonnet 5 rates, duration, turn count — tagged by ticket id or `empty_run: true` for no-ticket-queued runs.
  Exit: a simulated hook invocation against a fixture transcript produces the expected `*.usage.json` shape, including the empty-run case.

- [x] **M-OBS.2 — Efficiency-notes reporting convention** (T-047)
  A required "Efficiency notes" section in `REPORT_TEMPLATE.md`/`BLOCKED_TEMPLATE.md` where the executor self-reports *why* a run ran long or tight (e.g. superfluous context, pre-existing code needing a fix before the real work could start) — the qualitative half T-046's objective data can't provide on its own.
  Exit: both templates carry the new section; `EXECUTOR_ROUTINE.md` explicitly instructs writing it.

- [ ] **M-OBS.3 — Persist usage/efficiency/report data to a queryable store** (T-053)
  Ingest T-046's per-run JSON artifacts, T-047's efficiency notes, **and each ticket's morning/blocked report content** (outcome, what shipped, test evidence, reviewer verdict, "anything Alex must decide") into a real, queryable store — including reviewer-verdict/remediation-pass as structured fields, cache-read ratio, cost-per-changed-line, and blocked-outcome data as a first-class case. Resolved via `G-003`: a separate Neon branch/schema in a new `packages/observability` package, not new tables in `packages/core`.

- [ ] **M-OBS.4 — API endpoint(s) serving usage/efficiency/report data** (T-054, T-055)
  Read path over M-OBS.3's store — per-ticket and aggregate views (tokens, cost, duration, diff-size correlation, efficiency notes), plus a log/feed endpoint serving report content for browsing (T-054), and syncing PR diff stats (files/lines changed) automatically by ticket id rather than requiring a manual `gh pr list` pull (T-055). Both blocked on T-053's schema landing first.

- [ ] **M-OBS.5 — Observability dashboard UI** (T-057, T-058, T-059)
  A standalone dashboard (explicitly outside the v1 SourcesPage-only web surface — see `CLAUDE.md`) surfacing M-OBS.4's data across two surfaces: a trends view (cost, tokens, duration, diff-size correlation, per-tier granularity) and a log view (browsable per-ticket report feed, each entry carrying its own comment thread — the "logging center" half, now doubling as where Alex or a future agent annotates individual runs instead of a separate long-form Methodology section). Design/IA resolved via `G-004` (`Docs/tickets/gated/resolved/G-004-observability-dashboard-design.md`) — mockup at `Docs/mockups/observability-dashboard/`. Ticketed as T-057 (Trends, blocked on T-054/T-055), T-058 (Log view + comment-thread UI, blocked on T-054/T-055/T-057/T-059), and T-059 (comment schema + write endpoint, Alex-authored only for v1, blocked on T-053). Agent-authored comments are explicitly deferred, not scoped into any of these three.

- [x] **M-OBS.6 — Complexity tier + strategy-gate flag on the ticket format** (T-050)
  Adds `Complexity tier: S|M|L` and `Strategy-gate flag: yes|no` to `TICKET_SPEC.md`'s fixed ticket format, assigned by `ticket-writer` (and `/ungate`) on every future ticket, echoed into the final report — this is what makes every other tracked number interpretable per-tier instead of a flat average across wildly different ticket sizes. **Open question, not yet decided:** whether to retroactively tier the ~45 already-shipped tickets, or start tiering from here forward only — flagged in T-050 as out of scope for now, pending a decision.
  Exit: `TICKET_SPEC.md` documents both fields with a concrete S/M/L rubric; `ticket-writer` and the report templates reference assigning/echoing them.

- [ ] **M-OBS.7 — Cost model config: fully-loaded rate, review-time estimate, human-hour-equivalent by tier** (T-051)
  A small, clearly-labeled-as-assumptions config (`packages/core/src/observability/cost-model.ts`) holding what no transcript can supply: Alex's fully-loaded hourly rate, a default review-time-per-ticket estimate, and human-engineer-hour-equivalents per complexity tier (from M-OBS.6) — plus pure functions computing "total system cost" (agent + reviewer-subagent + review-time cost) and the cost-vs-human-equivalent ratio per tier.
  Exit: both functions unit-tested against fixture inputs; the assumption-vs-measurement distinction is explicit in code comments.

- [ ] **M-OBS.8 — Fix `manually_inspected` false-positive detection** (T-095)
  Investigated 2026-07-31: `summarizeUsage`'s human-message detection (M-OBS.1/T-046) treats any `user`-role transcript turn that isn't a plain string or a `tool_result` block as a human-typed message. In practice, skill/slash-command expansions and interrupt notices also arrive as `user` turns with array content whose blocks are `type: "text"` — so `humanMessageCount` climbs past 1, and `manually_inspected` fires, on nearly every run including fully autonomous ones. Fix the classification instead of removing the field.
  Exit: `summarizeUsage` correctly excludes framework-injected text-block user turns from `humanMessageCount`; regression tests cover the shapes found in real transcripts (skill-load text, `[Request interrupted by user]`) alongside the existing genuine-human-string case.

**Noted but deferred — not a ticket yet:** a churn/revert ratio (how much AI-generated code gets rewritten within 30 days) was raised as the metric that would answer whether "cheap" is also "durable." Not scoped here because "what counts as churn" (a reverted commit? a >50% line rewrite? a fixed 30-day window?) needs its own design pass first — drafting a ticket without that decision risks exactly the kind of invented scope `TICKET_SPEC.md` warns against. Worth a dedicated `/ungate`-style strategy conversation once the rest of v1.2 is running and there's real data to decide against.

---

## Milestone M-EFFICIENCY: Executor Token Efficiency

**Goal:** reduce the executor's own token spend at the source, not just measure it — the first two, most obviously wasteful patterns identified while auditing real runs: full test-command output re-injected into context on every intermediate TDD iteration, and sequential single-file reads where the full file list is already known up front.

**Context:** No PRD section covers this — same planning session as M-OBS, but a distinct concern (cutting waste vs. measuring it), kept as its own milestone rather than folded into M-OBS's task list.

### Tasks

- [x] **M-EFFICIENCY.1 — Filter test-command output in the TDD loop** (T-048)
  `pnpm lint && pnpm typecheck && pnpm test` currently returns its full stdout to the model on every call, including the many intermediate passing runs a TDD loop produces before the ticket is actually done. A wrapper script captures full output to a log file always, but only prints a pass/fail summary line per stage to the tool result on success — full output still prints (and is still available in the log) on failure, where it's actually needed to fix something, and the log remains readable at report-writing time so `REPORT_TEMPLATE.md`'s "paste actual output, not a summary" requirement for the *final* passing run is unaffected.
  Exit: a script invocation with a passing test suite prints only a summary line and exits 0; one with a failing suite prints the full failure output for the failing stage(s) and exits non-zero; the full output is byte-identical between the log file and what the unwrapped commands would have printed.

- [x] **M-EFFICIENCY.2 — Batch ticket context-file reads into one turn** (T-049)
  `EXECUTOR_ROUTINE.md` Step 3 currently has no instruction against reading a ticket's `Context files:` one at a time across multiple assistant turns — each additional turn re-sends the entire growing conversation history (the dominant cost driver identified in the planning session's real-run audit: ~98% of total tokens in a sampled run were cache-read overhead from repeated context resends). Where the full file list is already known up front (every ticket's `Context files:` field, by construction), instruct the executor to issue all of those `Read` calls as parallel tool calls within a single assistant turn instead.
  Exit: `EXECUTOR_ROUTINE.md` Step 3 explicitly instructs single-turn parallel reads for the ticket's known Context files list.

- [ ] **M-EFFICIENCY.3 — Gate executor process weight on ticket Complexity tier** (T-084)
  T-070 (docs-only, 7-line diff) cost ~$3.87 over 136 turns — almost entirely fixed process overhead (full TDD loop, per-file empirical checks), not diff-proportional. Once M-OBS.6's `Complexity tier: S | M | L` field exists on every ticket, S-tier docs/config-only tickets skip `EXECUTOR_ROUTINE.md` Step 4's TDD Red/Green/Refactor requirement (still gated on lint/typecheck/test green) instead of running the identical process every other tier does.
  Exit: see T-084 — `EXECUTOR_ROUTINE.md` Step 4 branches on tier for docs/config-only work; the lint/typecheck/test gate is unconditional regardless of tier.

- [ ] **M-EFFICIENCY.4 — Inline relevant IMPLEMENTATION_NOTES.md sections into ticket bodies** (T-085)
  `Docs/IMPLEMENTATION_NOTES.md` is a growing, append-only log that many tickets reference wholesale via `Context files:` even when only one `§` section applies — the executor loads the entire file to find one section, and that cost recurs every turn for the rest of the session. `ticket-writer` instead pastes the relevant section directly into the ticket body (with a heading + date citation for staleness-checking) when only one section is relevant.
  Exit: see T-085 — `ticket-writer/SKILL.md` and `TICKET_SPEC.md` document the new excerpt-and-cite convention; demonstrated against a real historical section.

### Ordering constraint

M-OBS.1, M-OBS.2, M-OBS.6, and M-OBS.7 have no dependency on each other or on anything else in this doc and can all ship immediately (M-OBS.7 references M-OBS.6's tier values but doesn't require it to have merged first — both are independent, self-contained config/doc changes). M-OBS.3 and M-OBS.4 wait on `G-003`; M-OBS.4 additionally depends on M-OBS.3's code once it ships, and should incorporate M-OBS.6/M-OBS.7's fields once those exist. M-OBS.5 (T-057/T-058/T-059) waits on M-OBS.4's code (T-054/T-055) once it exists; T-059 additionally only needs T-053 (not T-054/T-055) since it's a separate comment schema/endpoint, not a read over the run/report tables; T-058 waits on both T-057 (extends its app shell) and T-059 (its comment write endpoint). M-EFFICIENCY.1 and M-EFFICIENCY.2 have no dependency on each other, on M-OBS, or on anything in `Docs/milestones/MILESTONES_V1_1_MCP.md`, and can both ship immediately alongside M-OBS.1/M-OBS.2/M-OBS.6/M-OBS.7. M-EFFICIENCY.3 (T-084) is blocked on M-OBS.6 (T-050) merging — it branches on the `Complexity tier` field T-050 introduces, so it lands in `backlog/` until then. M-EFFICIENCY.4 (T-085) has no dependency on any of the above — it only changes `ticket-writer`'s own drafting procedure — and can ship immediately alongside M-EFFICIENCY.1/M-EFFICIENCY.2.
