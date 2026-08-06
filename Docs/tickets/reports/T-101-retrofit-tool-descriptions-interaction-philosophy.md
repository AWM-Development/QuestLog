# T-101 — Retrofit existing tools to the new agent-interaction policy

**Outcome:** shipped
**Branch:** feat/m-interact/t-101-retrofit-tool-descriptions-interaction-philosophy
**Diff:** 2 files changed, +52/-3 lines
**Complexity tier:** M
**Strategy-gate flag:** yes

## What shipped

`update_entity`, `log_session`, and `correct_lore`'s tool descriptions (`packages/mcp/src/content/tool-descriptions.ts`) now instruct the calling model to summarize the proposed change to the user in plain language before calling their paired `confirm_*` tool, retrofitting T-100's agent-interaction policy (`.claude/rules/mcp.md`) onto the write tools that predate it. Direct-write tools (`create_campaign`, `create_entity`, `append_entity_note`) and `ingest_text` (already carrying proactive-status-check language) needed no change. A new test file (`tool-descriptions.test.ts`) grep-checks narrate-before-confirm language on each retrofitted description, confirms preview/confirm mechanics language wasn't regressed, and confirms `ingest_text`'s status-checking guidance is intact.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (765 passed)
```

New test file run in isolation:

```
> @questlog/mcp@0.0.0 test /Users/alexandermeyer/Documents/Code/QuestLog/tmp/worktrees/T-101/packages/mcp
> vitest run tool-descriptions

 RUN  v3.2.4 /Users/alexandermeyer/Documents/Code/QuestLog/tmp/worktrees/T-101/packages/mcp

 ✓ src/content/tool-descriptions.test.ts (6 tests) 3ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — confirmed via `scripts/run-tests-quiet.sh` above (765 passed, 0 lint warnings, typecheck pass).
- **every `*_DESCRIPTION` constant identified in Scope for a `confirm_*`-paired tool contains explicit narrate-before-confirm language** — `UPDATE_ENTITY_DESCRIPTION`, `LOG_SESSION_DESCRIPTION`, `CORRECT_LORE_DESCRIPTION` each now include a "summarize ... to the user in plain language before calling confirm_*" clause, asserted by regex in `tool-descriptions.test.ts:19-27`.
- **no `*_DESCRIPTION` constant's preview/confirm mechanics description regresses** — `tool-descriptions.test.ts:30-38` asserts each retrofitted description still names its `confirm_*` counterpart and `token`; `CONFIRM_UPDATE_ENTITY_DESCRIPTION`/`CONFIRM_LOG_SESSION_DESCRIPTION` still describe what they apply (`tool-descriptions.test.ts:41-44`); `ingest_text`'s proactive-status language is unchanged and asserted intact (`tool-descriptions.test.ts:47-50`).

## Reviewer verdict

**PASS** (verbatim from the reviewer subagent):

> Everything checks out. The diff is minimal and precisely scoped: only the three preview-side descriptions paired with a `confirm_*` tool (`update_entity`, `log_session`, `correct_lore`) gained narrate-before-confirm language, exactly matching the ticket's Scope list; direct-write and already-compliant descriptions (`create_campaign`, `create_entity`, `append_entity_note`, `ingest_text`) were correctly left untouched. The new test file asserts real regex-matched language (not `toBeDefined()` theater), separately verifies preview/confirm mechanics language wasn't regressed, and checks `ingest_text`'s pre-existing proactive-status language — directly matching the Exit condition's grep-checkable requirement. No `.claude/rules/mcp.md` changes (correctly out of scope, that's T-100). No schema/behavior changes. Comment in the test file is a short, durable pointer to the rule/gate rather than restating the code.
>
> Ran the new test file directly: 6/6 pass.

## Efficiency notes

Straightforward, single-file scope with a pre-written, exhaustive list of constants to audit — no context-gathering surprises. The only judgment call was what to do about `archive_entity`/`unarchive_entity`, which share the same preview/confirm shape but weren't named in Scope (added by T-089, after this ticket was written); resolved by following the named list literally rather than inferring scope by shape, and logged in `IMPLEMENTATION_NOTES.md` in case it's an oversight worth a follow-up ticket.

**Retry log:** 0 retries. One Red→Green cycle (write failing regex-based test → add narrate-before-confirm clause to the three descriptions → green), one mechanical `biome check --write` pass for test-file formatting (not counted as a retry — no logic changed).

## Anything Alex must decide

`archive_entity`/`unarchive_entity` (T-089) have the same confirm-paired shape as the tools this ticket retrofitted but weren't named in T-101's Scope, so they were left untouched per the literal ticket text. If that's an oversight rather than a deliberate scoping choice, it's worth a small follow-up ticket to retrofit those two descriptions the same way.
