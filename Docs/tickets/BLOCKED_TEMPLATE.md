# Blocked Protocol

**Location:** `Docs/tickets/BLOCKED_TEMPLATE.md`
**Last Updated:** 2026-07-05

> A blocked ticket that cost one clean explanation is a success; a "solved" ticket that burned the weekly budget is a failure.

Copy this into `Docs/tickets/blocked/T-###-slug.md` (moved from `in-progress/`) when a ticket hits its iteration cap — 3 distinct approaches attempted on the same blocking failure — without reaching its exit condition. Do not attempt a 4th approach. Stop, fill this out, and end the session.

```markdown
# T-### — <title> — BLOCKED

## What failed

<The specific exit condition or checkpoint that could not be met. Quote the actual
failing assertion / error, not a paraphrase.>

## Approaches attempted

### 1. <approach>
<What you tried, and the evidence it didn't work — actual error output or test
failure, not "it didn't work.">

### 2. <approach>
<Same.>

### 3. <approach>
<Same.>

## Hypothesis

<Your best guess at the actual root cause, even if unproven. If you have no
hypothesis, say so explicitly rather than padding this section.>

## Exact question for Alex

<A single, answerable question. Not "what should I do?" — something Alex can
resolve in one message, e.g. "Should log_session's consolidation step treat a
renamed entity as an update or a new record?" or "The Voyage API is returning
403 for voyage-4-lite in CI but not locally — do you want to check the repo
secret, or should I fall back to voyage-3?">

## Branch state

- Branch: <name>
- Last commit: <sha + message>
- Uncommitted changes: <yes/no — if yes, what and why left uncommitted>
- Tests: <passing / failing — which ones>
```

## Notes for the executor

- This is not a failure to hide. A precise blocked report is more valuable than a fragile "fix" that papers over a real ambiguity or a real bug in a dependency.
- The iteration cap applies to review remediation too — if the reviewer subagent returns FAIL and the one remediation pass doesn't resolve it, that's also a stop, filed the same way.
- Do not weaken the ticket's exit condition to make it pass. If the exit condition itself seems wrong, that's the "exact question" — not something to silently reinterpret.
- Resolving this is Alex's job, not the executor's. A future run will only ever *skip* this ticket if it encounters its branch again (`EXECUTOR_ROUTINE.md` Step 1, case 3) — it never re-attempts or unblocks it. See `TICKET_SPEC.md` §"Unblocking a blocked ticket" for how it gets back into `queue/`.
