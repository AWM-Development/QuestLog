# T-160 — `list_sources` MCP tool

**Outcome:** shipped
**Branch:** feat/m-bug/t-160-list-sources-mcp-tool
**Diff:** 5 files changed, +137/-1 lines
**Complexity tier:** S
**Strategy-gate flag:** no

## What shipped

A new `list_sources` MCP tool that returns a campaign's ingested sources — id, name, type, status, sizeBytes, createdAt, updatedAt — with no raw `metadata` or `storageKey` leaked. Pure wiring: `sourceService.listByCampaign` and `ListSourcesInput` already existed and were unused.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (946 passed)
```

(Full `scripts/run-tests-quiet.sh` output; per-stage detail persisted under `tmp/test-logs/` in this worktree.)

## Exit condition check

- **all tests green, typecheck clean, lint clean** — confirmed above.
- **new `server.test.ts` assertions: empty campaign returns `{ sources: [] }`; a campaign with 2 ingested sources returns both with `id`/`name`/`type`/`status`/`sizeBytes`/`createdAt`/`updatedAt` present and `metadata`/`storageKey` absent; a source belonging to a different `campaignId` is excluded** — all three added verbatim to the new `"list_sources tool"` describe block (`packages/mcp/src/server.test.ts:2732-2828`), all passing.

## Reviewer verdict

**PASS.** Reviewer subagent's findings (verbatim):
- `list-sources.ts` matches the `list_entities`/`get_source_status` precedent exactly: thin `register<Tool>(server, { db })` adapter, `withToolErrors`-wrapped, hand-shaped DTO that explicitly omits `metadata`/`storageKey`/`hash`. Complies with `.claude/rules/mcp.md`'s thin-adapter, one-file-per-tool, and description-in-`tool-descriptions.ts` requirements.
- `sourceService.listByCampaign` is already `campaignId`-scoped (T-068 compliant); auto-discovered by `campaign-scoping.test.ts`.
- The three new tests are real assertions, not theater — matches the ticket's exit condition precisely.
- `onboarding-instructions.ts` addition is consistent with existing pattern, not scope creep.
- Out-of-scope items (delete_source, ingest_text/get_source_status/service changes, pagination/filtering, schema changes) untouched — no scope creep.
- No pattern deviations, no DRY/sprawl issues, no comment-discipline issues.

## Efficiency notes

Straightforward wiring ticket that ran exactly to plan — one Red/Green pass, no refactor needed since the new tool is a direct copy of an existing precedent (`list_entities`). One scoping gap surfaced mid-ticket, noted below.

**Retry log:** 1 retry, `mechanical_lint_typecheck`-adjacent (not lint/typecheck itself, but a pre-existing regression test): `scripts/run-tests-quiet.sh`'s first pass failed `onboarding-instructions.test.ts`'s T-140 drift guard, which asserts every registered tool name is mentioned in `ONBOARDING_INSTRUCTIONS`. Fixed by adding `list_sources` to that string's existing read-tools bullet. 0 `genuine_bug_caught_by_test` retries — the tool implementation itself was correct on the first pass.

## Anything Alex must decide

None. One scoping note: the ticket's `Context files:` list didn't include `onboarding-instructions.ts`, but T-140's drift guard (a pre-existing test, not new work) required a one-line addition there to keep `pnpm test` green — a mechanical, same-pattern edit (added `list_sources` to the existing bulleted list of read tools), not a scope expansion of the ticket's actual behavior.

Also flagged during this run's Step 1, outside this ticket's scope: [T-159](../queue/T-159-ingest-text-error-response-after-partial-success.md) exists in this checkout as a full 74-line draft ticket that was never committed/pushed to `develop` — `origin/develop`'s copy is a one-line title stub. Per Alex's direction this run, T-159 was left untouched and the executor moved on to the next candidate (T-160). T-159 still needs to be committed to `develop` before it can be picked up by a future run.
