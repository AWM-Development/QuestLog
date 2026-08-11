# T-139 — Tool-description naming & length/format consistency pass

**Outcome:** shipped
**Branch:** feat/m-polish/t-139-tool-description-consistency-pass
**Diff:** 2 files changed, +114/-16 lines
**Complexity tier:** S
**Strategy-gate flag:** yes (provenance only — no unresolved 🧠 gate found in this ticket's own scope; see `TICKET_SPEC.md`'s field notes)

## What shipped

Standardized two conventions across every exported tool description in `packages/mcp/src/content/tool-descriptions.ts`: (1) every "Direct write" label now sits immediately after the description's first sentence, not buried after other elaboration; (2) every non-preview-only tool description now ends with an explicit "Returns ..." clause naming its returned shape, while the five genuinely preview-only descriptions (`update_entity`, `archive_entity`, `unarchive_entity`, `log_session`, `correct_lore`) stay exempt. New tests in `tool-descriptions.test.ts` lock both patterns in across the full 22-constant exported set.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (861 passed)
```

(`scripts/run-tests-quiet.sh`, run from the ticket's worktree after the implementation commit.)

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see Test evidence above; `pnpm --filter @questlog/mcp test -- tool-descriptions` alone reports 31/31 passed before the full-suite run.
- **Every "Direct write" description places the label in the same position (first sentence, then label, then any elaboration)** — verified by `tool-descriptions.test.ts`'s `DIRECT_WRITE_RIGHT_AFTER_FIRST_SENTENCE` regex test, run against all 3 direct-write constants (`CREATE_CAMPAIGN_DESCRIPTION`, `CREATE_ENTITY_DESCRIPTION`, `APPEND_ENTITY_NOTE_DESCRIPTION`).
- **Every non-preview-only description ends with a "Returns ..." clause** — verified by `tool-descriptions.test.ts`'s `ENDS_WITH_RETURNS_CLAUSE` regex test, run against all 17 non-preview constants (positive case) and all 5 preview-only constants (negative case, asserting they're correctly exempt).

## Reviewer verdict

PASS. Reviewer subagent notes (verbatim):

> No issues found. The diff is tightly scoped to `packages/mcp/src/content/tool-descriptions.ts` and its test file, matches the ticket's two named drifts, and the new tests (`packages/mcp/src/content/tool-descriptions.test.ts:63-135`) exhaustively cover all 22 exported constants (3 direct-write, 17 non-preview-with-Returns, 5 preview-exempt), so nothing in the exported set is left unlocked.
>
> Spot-checks:
> - `packages/mcp/src/content/tool-descriptions.ts:11,20,23` — the three "Direct write" descriptions now consistently place the label right after the first sentence, matching `tool-descriptions.test.ts:71-80`'s `DIRECT_WRITE_RIGHT_AFTER_FIRST_SENTENCE` regex.
> - `packages/mcp/src/content/tool-descriptions.ts` (CONFIRM_LOG_SESSION, CREATE_ENTITY, GET_SOURCE_STATUS Returns clauses) — cross-checked against actual handler return shapes in `packages/mcp/src/tools/confirm-log-session.ts:97-102`, `packages/mcp/src/tools/create-entity.ts:26-33`, and the get-source-status handler; all accurate, not just plausible-sounding.
> - Out of scope respected: no diff touches `packages/mcp/src/content/onboarding-instructions.ts` or `packages/mcp/src/tools/*.ts`; T-101 philosophy sentences (confirmation-narration, proactive-status-checking) are untouched verbatim, only reordered/relocated where the Returns/Direct-write convention required.
> - Ran `vitest run packages/mcp/src/content/tool-descriptions.test.ts`: 31 tests passed, no test theater.
>
> PASS

## Efficiency notes

Ran long primarily because the ticket's two illustrative examples ("CREATE_CAMPAIGN and CREATE_ENTITY have a Returns clause; six others don't") turned out not to match the file's actual current state (`CREATE_ENTITY_DESCRIPTION` had no Returns clause at all before this ticket) — the real scope, once the exit condition's literal wording ("every non-preview-only description") was applied, was a full 17-constant pass rather than the ~6 the Scope text's illustrative list implied. Spent extra turns classifying preview-vs-non-preview for all 22 exported constants and grepping tool-handler `return` statements (outside the ticket's named Context files) to avoid fabricating field names in the new Returns clauses — a deliberate, disclosed exception to "don't silently pull in extra files," since accuracy of the actual deliverable (documentation naming real return shapes) depended on it.

Also lost time to an unrelated environment provisioning failure on first worktree bootstrap (`questlog_test_observability` never got migrated locally) — root-caused and worked around; see "Anything Alex must decide" below and the new `Docs/IMPLEMENTATION_NOTES.md` § T-139 entry for the full writeup.

**Retry log:** 0 retries against the ticket's own iteration cap — the implementation was green on the first Red→Green pass. One `lint` failure (Biome formatting on the new test file's array literals) fixed via `biome check --write`, not counted as a retry against Scope's logic (mechanical formatting, not a failed approach).
- `environment_setup`: 1 (the worktree-bootstrap provisioning failure above — not a retry against this ticket's own test loop, since it happened during Step 2's environment setup, before any Red/Green iteration began)
- `mechanical_lint_typecheck`: 1 (Biome array-literal formatting, auto-fixed)
- `genuine_bug_caught_by_test`: 0

## Anything Alex must decide

1. **Interpretation call on "Returns clause" scope:** the ticket's Scope text named only 6 constants as lacking a Returns clause; this report treats the exit condition's literal wording ("every non-preview-only description") as authoritative and applies the convention to all 17 non-preview constants in the file, not just the 6 named ones. If that's broader than intended, the extra 11 rewrites (`QUERY_LORE`, `PREP_BRIEF`, `LIST_CAMPAIGNS`, `LIST_ENTITIES`, `GET_ENTITY`, `CONFIRM_UPDATE_ENTITY`, `CONFIRM_LOG_SESSION`, `INGEST_TEXT`, `CONFIRM_CORRECT_LORE`, `HELP`, plus the field-content of `CREATE_ENTITY`'s new clause) are easy to revert or narrow in a follow-up.
2. **Real, live provisioning bug found (not fixed here, out of Context files/Scope):** `packages/observability/src/db/migrate.ts` prefers `OBSERVABILITY_DATABASE_URL` over the `DATABASE_URL` `session-start.sh` passes it for local test-DB provisioning. Since T-131 started propagating the primary checkout's `.env` (including the real `OBSERVABILITY_DATABASE_URL`) into every fresh worktree, `session-start.sh`'s local `questlog_test_observability` migration has been silently running against the remote Neon database instead, leaving the local test DB permanently unmigrated on every fresh worktree since T-131 merged. Full root-cause and the local workaround used to unblock this ticket: `Docs/IMPLEMENTATION_NOTES.md` § "T-139 — T-131 regression". Worth its own follow-up ticket — I've flagged it as a spawned suggestion rather than fixing it here, since it's squarely outside this ticket's named Context files.
