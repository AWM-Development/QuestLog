# T-100 — Write the agent-interaction policy into `.claude/rules/mcp.md`

**Outcome:** shipped
**Branch:** feat/m-interact/t-100-agent-interaction-philosophy-rule
**Diff:** 4 files changed (ticket-tracking moves excluded), +27/-1 lines
**Complexity tier:** S
**Strategy-gate flag:** yes (informational — this ticket is the output of `G-012`'s already-resolved decision; no unresolved 🧠 marker appears in its own scope)

## What shipped

`.claude/rules/mcp.md` (mirrored to `.cursor/rules/mcp.mdc`) now states a standing three-axis agent-interaction policy: confirmation narration before any `confirm_*` call, proactive status-polling for async tools, and translating tool errors into plain, non-alarming language. The error-tone sentence itself was added once to `ONBOARDING_INSTRUCTIONS`, applying uniformly to every tool rather than being repeated per description.

## Test evidence

```
> @questlog/mcp@0.0.0 test
> vitest run

 ✓ src/tools/campaign-scoping.test.ts (3 tests) 2ms
 ✓ src/server.test.ts (75 tests) 3945ms
   ✓ global-setup DB truncation wiring (T-052) > truncates questlog_test_mcp (this package's own DB), not questlog_test, on a fresh run  2655ms

 Test Files  2 passed (2)
      Tests  78 passed (78)
```

Full-repo quiet pipeline (`scripts/run-tests-quiet.sh`):

```
lint: pass (0 warnings)
typecheck: pass
test: pass (741 passed)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see pasted output above (78/78 in `packages/mcp`, 741 passed repo-wide; lint and typecheck both clean).
- **`.claude/rules/mcp.md` contains a new section stating all three rules in prescriptive language** — new "Agent-interaction philosophy (T-100, `G-012`)" section, `.claude/rules/mcp.md:43-49`, covers "confirm" (rule 1), "proactively"/"poll" (rule 2), and "error" (rule 3).
- **`ONBOARDING_INSTRUCTIONS` contains the error-tone sentence** — `packages/mcp/src/content/onboarding-instructions.ts:13` adds: "If a tool call returns an error, translate its `{ error: { code, message } }` result into a plain, non-alarming explanation with a suggested next step — don't relay the raw JSON to the user."
- **Existing `packages/mcp` test suite still passes** — confirmed above (78/78); added one new test (`server.test.ts:494-501`) asserting the onboarding instructions match `/error/i` and `/plain|non-alarming/i`, run via the initialize-response path (`client.getInstructions()`), the same pattern the existing T-033/T-065 tests in that `describe` block already use.

## Reviewer verdict

**PASS.** Reviewer verbatim:

> Lint clean. Everything checks out: scope delivered exactly as specified (three rules in `.claude/rules/mcp.md`, mirrored to `.cursor/rules/mcp.mdc` per existing repo convention), the shared error-tone sentence added once to `ONBOARDING_INSTRUCTIONS` rather than per-tool, out-of-scope `tool-descriptions.ts` left untouched, a real (if loosely-matched) test added and passing, lint/typecheck/tests all green. No scope creep, no test theater, no comment bloat — the new rule-file prose is prescriptive policy text (expected for a rules file), not a narrative comment in code.
>
> Findings (minor, non-blocking):
> - `packages/mcp/src/server.test.ts:494-501` — the new test uses loose regexes (`/error/i`, `/plain|non-alarming/i`) rather than asserting the literal sentence; would pass even if wording drifted to something only weakly related. Acceptable given the ticket's own exit condition is phrased as a grep-check, but worth a glance.
>
> PASS

Left as-is per Step 5 ("PASS or PASS-WITH-NOTES: proceed to Step 7") — noted here for visibility, not remediated.

## Efficiency notes

Straightforward ticket: one failing test, one two-part content edit (rule file + onboarding string), plus the mirrored `.mdc` copy the file's own header comment requires. No genuine bugs surfaced — the only friction was environment bootstrap (fresh worktree needed `pnpm install` + `session-start.sh`'s per-worktree Postgres provisioning run manually, since this session's own `SessionStart` hook had already fired against the primary directory before the worktree existed).

**Retry log:** 0 retries against the iteration cap. 1 `environment_setup` action outside the cap (running `session-start.sh` inside the new worktree before tests could run at all — expected per-worktree bootstrap, not a failed attempt).

## Anything Alex must decide

None. Also worth flagging (not blocking, not part of this ticket's scope): while selecting this ticket, live PR checks surfaced that `Docs/tickets/queue/T-081-extracted-entity-review-marker.md` is a stale duplicate — that ticket already merged (PR #187) and also has a `done/` copy, but its `queue/` copy was never removed. And `Docs/tickets/queue/` currently has two distinct tickets both titled `T-104` (`T-104-cite-not-restate-implementation-notes-rationale.md` and `T-104-runner-neutral-project-dir-default.md`) — an id collision worth a follow-up ticket-hygiene pass.
