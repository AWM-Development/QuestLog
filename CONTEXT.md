# Sub-ticket B: Audit stats/format helper sprawl

**Branches off:** `feat/m-obs/t-057-observability-dashboard-trends-view` (PR #310), at `617efc5`.
**PR target:** into that branch, not `develop`.
**Not run through `ticket-writer`/`TICKET_SPEC.md`** — informal context doc per Alex's call during `/morning-review`'s deep review of T-057 (2026-08-23).

## Why this is split out

From PR #310 review comment on `stats.ts:15` (comment id `3839320267`):

> reason we are standing up our own median and average utility functions? maybe there's a lightweight library we can add that gives us some of these math functions? might helps with the sprawl of helper utilities for this charting

This is a real, open question — not a known answer to just apply. `apps/observability-dashboard/src/features/trends/utils/stats.ts` hand-rolls `median()` and `average()` (4-5 lines each), and `utils/format.ts` hand-rolls its own cost/token/turns/duration formatters. Whether that's actually sprawl worth fixing, or normal-sized utility code for what this app needs, isn't obvious without checking what's actually available.

## Scope (investigate-and-report, not a known fix)

- Check whether `recharts` (already a dependency) or any other already-installed package in the monorepo already exposes `median`/`average`/similar — pulling in a whole stats library for two four-line functions may not be worth it even if one exists.
- If a genuinely lightweight option exists (small bundle-size cost, no new transitive dependency sprawl of its own), evaluate swapping to it.
- While in there, sweep `format.ts` too — same question: is there duplication or oddly-scoped logic worth consolidating, or is it appropriately sized already?
- Write up the actual findings, even if the conclusion is "current code is fine, no change" — Alex asked to "share your findings," and a negative result is a valid, useful one.

## Exit condition

- All tests green, typecheck clean, lint clean (whatever code changes result, if any).
- A short writeup (PR description is fine) stating what was checked and why the resulting decision (change or no change) is the right one — this is the deliverable as much as any code diff.

## PR comment thread this closes (reply + resolve on PR #310 once done)

- `stats.ts:15` (comment id `3839320267`)
