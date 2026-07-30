# T-046 — Executor usage-capture hook

**Outcome:** shipped
**Branch:** feat/m-obs/t-046-executor-usage-capture-hook
**Diff:** 14 files changed, +968/-0 lines

## What shipped

A Claude Code `Stop` hook now fires at the end of every session in this repo and writes a per-run usage artifact (`Docs/tickets/reports/T-###.usage.json`) recording token totals, wall-clock duration, turn count, the turn where the TDD loop first went green, theoretical Sonnet 5 cost (intro and standard rates), reviewer-subagent cost kept separately visible, and a `manually_inspected` flag for sessions Alex interrupted mid-run. Runs with no resolvable ticket id are tagged `empty_run: true` instead of erroring.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (602 passed)
```

New test files specifically: `pricing.test.ts` (7 tests), `usage-summary.test.ts` (9 tests), `artifact.test.ts` (3 tests), `capture-usage.test.ts` (2 tests) — 21 new tests, all passing.

One pre-existing, order-dependent flaky test (`src/db/global-setup.test.ts`'s FK-cleanup case) was observed failing once during a full-suite run and passing on every other run (isolated and re-run twice); confirmed via `git stash` that it fails/passes independently of this ticket's changes — not something this diff touches or introduced.

## Exit condition check

- All tests green, typecheck clean, lint clean — see Test evidence above.
- `usage-summary.ts`'s `summarizeUsage` unit-tested against fixture JSONL with hand-computed token totals, duration, and `turns_to_green` (including a fixture where no passing run occurs → `turns_to_green: null`) — `usage-summary.test.ts:52-121`.
- A fixture transcript directory with a sibling `subagents/*.jsonl` produces a combined artifact where main totals, `reviewer_subagent`, and their sum are all independently correct — `capture-usage.test.ts:24-55` (fixture: `__fixtures__/session-with-subagents/`).
- A fixture with exactly one user message produces `manually_inspected: false`; a fixture with more produces `true` and the correct `human_message_count` — `usage-summary.test.ts:53-102` and `123-141`.
- `pricing.ts`'s cost function, given a fixed usage summary and fixed date, returns the correct intro-vs-standard rate and arithmetically correct dollar figures for both — `pricing.test.ts` (7 tests covering standard/intro rates, explicit 5m TTL override, zero-token edge case, and the intro/standard date boundary).
- A simulated hook invocation (fake stdin payload, fixture transcript, no real Claude Code session) produces a `*.usage.json` file with the full expected shape — `capture-usage.test.ts:24-55`.
- A second simulated invocation with a fixture transcript that has no resolvable ticket id produces `empty_run: true` instead of erroring — `capture-usage.test.ts:57-77` (fixture: `__fixtures__/session-no-ticket/`).

## Reviewer verdict

**PASS-WITH-NOTES**

> 1. Scope/exit conditions: all covered and verified by running the four new test files directly — 21 tests, all passing. Token summing, `turns_to_green` (both found and null cases), `human_message_count`/`manually_inspected` (both true/false), subagent-summing with independently-visible totals, intro-vs-standard pricing with correct arithmetic, and the two simulated hook invocations are all exercised with hand-computed expected values, not toBeDefined()-style theater.
> 2. Out of scope respected: no DB writes, no changes to EXECUTOR_ROUTINE.md Steps 1-6, no dashboard/UI, no retry-reason categorization.
> 3. Thin-wrapper/tested-service split honored — the hook script is a pure pass-through, and capture-usage.ts's only impure bits (execSync, readFileSync(0), writeFileSync) are isolated at the edges with resolveTicketId injected for testability.
> 4. Judgment calls: turns_to_green heuristic is well-justified and matches T-048's script output exactly. Human-message vs. tool-result disambiguation is reasonable and tested. 1h cache-TTL default has an inline WHY comment pointing at IMPLEMENTATION_NOTES.md § T-046 (added at Step 7, as expected).
> 5. Minor nit (DRY): capture-usage.ts had two separate imports from usage-summary.js instead of one merged import. Trivial, doesn't affect behavior.
>
> No functionality gaps, no scope creep, no test theater found. The one style nit above is not blocking.

Remediation: merged the duplicate import (`refactor(T-046): merge duplicate usage-summary import`), re-ran the full lint/typecheck/test chain clean afterward.

## Anything Alex must decide

- **Cache-TTL default for cost estimates**: `pricing.ts` defaults cache-write cost to the 1-hour multiplier (not Anthropic's 5-minute default), based on this session's own system context stating Claude Code sessions here run under a 1h prompt-cache TTL. Documented in `Docs/IMPLEMENTATION_NOTES.md` § T-046. If that's wrong for some session types, the artifact's costs will be understated (5m TTL costs less per cache-write token than 1h).
- **`turns_to_green` detection is coupled to `scripts/run-tests-quiet.sh`'s exact output wording** (T-048). If that script's pass/fail phrasing changes, this heuristic needs a matching update — flagged in IMPLEMENTATION_NOTES.md so the coupling isn't a surprise later.
- No 🧠 gates were hit; G-003 (observability data storage location) was already resolved before this ticket started and doesn't block it — T-046 stays file-only, per that gate's resolution.
