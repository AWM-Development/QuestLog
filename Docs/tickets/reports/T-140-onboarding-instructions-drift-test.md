# T-140 — ONBOARDING_INSTRUCTIONS drift test

**Outcome:** shipped
**Branch:** feat/m-polish/t-140-onboarding-instructions-drift-test
**Diff:** 4 files changed, +83/-2 lines
**Complexity tier:** S
**Strategy-gate flag:** yes

## What shipped

A new test (`packages/mcp/src/content/onboarding-instructions.test.ts`) derives the live list of registered MCP tool names straight from each `packages/mcp/src/tools/*.ts` file's own `registerTool("<name>", ...)` call and asserts every one appears in `ONBOARDING_INSTRUCTIONS` — a future tool shipped without an onboarding-prose update now fails a test instead of silently going undocumented. Implementing the test surfaced real, pre-existing drift: 7 registered tools (`archive_entity`, `confirm_archive_entity`, `unarchive_entity`, `confirm_unarchive_entity`, `correct_lore`, `confirm_correct_lore`, `confirm_ingest_entities`) were missing from the prose. Per Alex's resolution to this ticket's blocked report, the prose now mentions all 7.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (862 passed)
```

Isolated run of the new test file:

```
 ✓ src/content/onboarding-instructions.test.ts (1 test) 3ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — confirmed above (862 passed, 0 lint warnings, typecheck pass).
- **the new test passes today against every currently-registered tool name** — confirmed above; the derived list covers all 22 registered tools (`help` intentionally exempted from the scan — see Reviewer verdict).
- **proof the assertion actually detects drift** — before the prose fix, the test as originally written (deriving names live, no hardcoded list) failed on real `develop` code with no fake tool involved:
  ```
  AssertionError: expected [ 'archive_entity', …(6) ] to deeply equal []
  ```
  (Full 7-item list and root cause: `Docs/tickets/blocked/`'s prior report, now folded into this ticket's Resolution section and `IMPLEMENTATION_NOTES.md` § T-140.) After the prose fix, a second, ticket-required proof: temporarily renamed `confirm_ingest_entities`'s registration to `totally_fake_drift_probe_tool` in `packages/mcp/src/tools/confirm-ingest-entities.ts`, reran the test — failed as expected:
  ```
  AssertionError: expected [ 'totally_fake_drift_probe_tool' ] to deeply equal []
  ```
  then reverted (`git checkout -- packages/mcp/src/tools/confirm-ingest-entities.ts`) and confirmed green again before the final commit.

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim:

> Verified functionality: Confirmed by direct execution that the new test derives tool names live from `packages/mcp/src/tools/*.ts` registration call sites (not a hardcoded literal list, as the ticket required) and genuinely detects drift: I injected a fake tool name into `packages/mcp/src/tools/get-entity.ts`, reran the test, watched it fail with the fake name listed as missing, then reverted. [...] The implementation correctly went beyond the "Resolution" note's stated scope of 6 missing tools and also added `confirm_ingest_entities` (a 7th genuinely-missing registered tool [...]), which is necessary for the test to actually pass today, not scope creep.
>
> One fragility worth a glance: `onboarding-instructions.test.ts` uses plain substring matching against a derived list that includes `help` [...] It currently passes only because `onboarding-instructions.ts` contains the word "helps" [...] — a coincidental substring match, not a deliberate check that the `help` tool is documented. [...] either exclude `help.ts` from the scan (matching the ticket's own stated exemption) or accept the coupling knowingly.
>
> Other checks: no conflict with `.claude/rules/mcp.md`; Out of scope (`no codegen`, `no changes to help tool`) respected — the prose-text change is explicitly authorized by the recorded Resolution section; no test theater; no DRY/sprawl issues; comment discipline clean.

**Addressed before wrap-up:** applied the suggested fix — `help` is now explicitly exempted from the derived-name scan (`EXEMPT_TOOL_NAMES`), citing the ticket's own Out-of-scope note as the reason, rather than relying on the coincidental "helps" substring match. Full suite re-verified green after the change (evidence above).

## Efficiency notes

The ticket's own Out-of-scope premise ("[the prose] already mentions every currently-registered tool") was factually wrong by the time this ticket ran — a straightforward implementation of the described test caught that immediately on first run, before any retry loop was needed. This wasn't an iteration-cap situation (no failed *technical* approach, no ambiguity to retry against): the contradiction was visible from one literal check, confirmed with one real test run, and resolved by asking Alex rather than guessing which side of the contradiction to break. Once Alex's answer came back, the remaining implementation (7-tool prose update, fake-tool-injection proof, reviewer's `help`-exemption suggestion) was a single clean pass with no further failures.

**Retry log:** 0 retries against the iteration cap. (The initial blocked run logged 1 `genuine_bug_caught_by_test` in its own report — the test, implemented exactly as scoped, correctly caught real prose drift the ticket didn't expect to still be present — but that was resolved by Alex's decision, not by a retried implementation approach.)

## Anything Alex must decide

None — your answer to the blocked report's question ("Yes include the missing tools") is what let this ship. One thing worth knowing: the drift this ticket found (7 tools, not the blocked report's stated 6 — `confirm_ingest_entities` was also missing, an undercount in that report's own tally) is now fully closed, and the new test guards against it recurring.
