# T-096 — Fix `manually_inspected` false-positive detection

**Outcome:** shipped
**Branch:** tickets/m-obs.8
**Diff:** 2 files changed, +85/-1 lines (packages/core)
**Complexity tier:** S
**Strategy-gate flag:** no

## What shipped

`summarizeUsage` no longer counts framework-injected `user`-role transcript turns (skill/slash-command load expansions, interrupt notices) as human-typed messages, so `manually_inspected` only fires when Alex actually sent a real follow-up message mid-run — not on nearly every run as before.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (645 passed)
```

Targeted run before the full chain:
```
 ✓ summarizeUsage > sums tokens, computes duration and turn count, and finds turns_to_green
 ✓ summarizeUsage > emits turns_to_green: null when no passing run occurs
 ✓ summarizeUsage > flags manually_inspected when more than one human message is present
 ✓ summarizeUsage > does not count a skill/slash-command load expansion as a human message
 ✓ summarizeUsage > does not count an interrupt notice as a human message
 ✓ summarizeUsage > prices from the transcript's own ephemeral 5m/1h cache-creation split when present
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

## Exit condition check

- all tests green, typecheck clean, lint clean — see pasted output above
- skill-load-style text-block turn + one genuine human-string kickoff turn → `humanMessageCount: 1` / `manuallyInspected: false` — `usage-summary.test.ts` "does not count a skill/slash-command load expansion as a human message"
- interrupt-notice text-block turn(s) + one genuine human-string kickoff turn → `humanMessageCount: 1` / `manuallyInspected: false` — `usage-summary.test.ts` "does not count an interrupt notice as a human message"
- existing "flags manually_inspected when more than one human message is present" test (genuine second human string turn) unmodified and still passing — a real second human message still trips `manuallyInspected: true`

## Reviewer verdict

**PASS.** Verbatim:

> Scope check: The fix adds `isInjectedTextBlock`/`isInjectedTextTurn` (`usage-summary.ts:79-100`) matching exactly the two confirmed shapes named in the ticket... no broader classifier was built, honoring the "Out of scope" clause against speculative hardening.
> Tests: Two new regression tests use fixture JSONL built from the real shapes described in the ticket... Assertions are concrete (exact counts/booleans), not theater.
> Exit condition: All three machine-checkable exit bullets are satisfied by the diff as verified above.
> Pattern/comment discipline: WHY-focused, points to IMPLEMENTATION_NOTES.md § T-096 (added in wrap-up, after the review ran).
> DRY: No duplication introduced.
> Out of scope violations: None found.
> Scope creep: None.

## Efficiency notes

Tight run — root cause was already identified via investigation before the ticket was drafted (real transcript sampling found the two injected shapes directly), so implementation was a straight-line TDD loop with no exploratory dead ends. The only non-code overhead was a fresh worktree needing `pnpm install` (no `node_modules` yet) and one Biome auto-format fix.

**Retry log:** 1 retry: 1 `mechanical_lint_typecheck` (Biome wanted the ternary-turned-boolean-expression wrapped in parens; auto-fixed with `biome check --write`).

## Anything Alex must decide

None. This ticket was drafted directly into `queue/` (no gate) since the fix-vs-remove decision was made interactively with Alex before drafting — confirmed via `AskUserQuestion` that "fix detection" was the chosen scope, given the root cause was a classification bug rather than the signal itself being valueless. Deviation from the normal pipeline shape, per Alex's explicit request: ticket-drafting and implementation both landed on one branch (`tickets/m-obs.8`) and one PR, rather than the usual two-PR (ticket-writer PR, then a separate executor PR) split.
