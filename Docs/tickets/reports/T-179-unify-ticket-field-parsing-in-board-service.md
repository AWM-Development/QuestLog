# T-179 — Unify ticket-field parsing in board.service.ts

**Outcome:** shipped
**Branch:** feat/m-obs/t-179-unify-ticket-field-parsing
**Diff:** 2 files changed, +111/-34 lines
**Complexity tier:** S (from the ticket)
**Strategy-gate flag:** no (from the ticket)

## What shipped

`board.service.ts`'s two separate ticket-field parsing strategies (`matchField`'s single-line regex and `extractScopeExcerpt`'s shape-based multi-line boundary heuristic) are unified into one `parseAllFields(content)` pass, using an explicit allowlist of `TICKET_SPEC.md`'s actual top-level field names instead of the old "capitalized word ending in a colon" shape check. The old heuristic could mistake a hard-wrapped `Scope:` prose line (e.g. `"Note: fall back to null."` at column 0) for the start of the next field and silently truncate the excerpt early — the allowlist only fires on real field names, so that false positive can no longer happen. `parseTicketFile` now reads every field from `parseAllFields`'s single map instead of calling `matchField` per field plus `extractScopeExcerpt` separately.

## Test evidence

```
$ scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (990 passed)
```

Targeted run of the two exit-condition-named suites, for reference:

```
$ pnpm --filter @questlog/core exec vitest run src/services/board.service.test.ts
 ✓ |core| src/services/board.service.test.ts (17 tests) 4ms
 Test Files  1 passed (1)
      Tests  17 passed (17)

$ pnpm --filter @questlog/server exec vitest run src/routers/board.test.ts
 ✓ src/routers/board.test.ts (1 test) 46ms
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — `scripts/run-tests-quiet.sh` above: lint pass, typecheck pass, test pass (990 passed).
- **Existing fixture-based `board.service.test.ts` cases (Branch/Priority/Complexity tier/Blocked on/Gated on/Scope extraction, including T-165's long-Scope/short-Scope/no-Branch-no-Scope cases) all still pass unmodified** — all 17 tests in the file pass, none of the pre-existing fixtures or assertions were edited (`board.service.test.ts:8-105`, `123-225`, `235-241` unchanged).
- **A new fixture whose `Scope:` prose contains a hard-wrapped line matching the old heuristic's false-positive shape returns a `scopeExcerpt` that includes that line's text rather than truncating before it** — `TICKET_WITH_SCOPE_FALSE_POSITIVE_LINE` (`board.service.test.ts:107-131`) has a `Scope:` value with a hard-wrapped `"Note: fall back to null if the value is missing entirely."` line at column 0; the new test (`board.service.test.ts:261-267`) asserts `card?.scopeExcerpt` contains that text. Confirmed failing against the pre-fix code (old heuristic truncated at the `Note:` line — Red step), passing after the fix (Green step).
- **`apps/server/src/routers/board.test.ts`'s existing fixture-based assertions still pass unmodified** — 1/1 passing, file untouched.

## Reviewer verdict

PASS-WITH-NOTES

Reviewer's verbatim findings:

> **Scope / exit condition**
> - The allowlist replaces the shape-based heuristic exactly as specified: `packages/core/src/services/board.service.ts:54-70` (`TOP_LEVEL_FIELDS`, `FIELD_START_PATTERN`) matches `TICKET_SPEC.md`'s field set plus `Branch`/`Scope`.
> - Single-pass unification delivered via `parseAllFields` (`board.service.ts:81-93`), consumed by both `singleLineValue` (single-line fields) and `scopeExcerptValue` (Scope), replacing the old `matchField`/`extractScopeExcerpt` duo. `parseTicketFile` now reads from one map (`board.service.ts:148-165`).
> - New regression fixture/test (`board.service.test.ts:107-131`, `:261-267`) reproduces exactly the false-positive case named in the ticket (`Note:` hard-wrap inside `Scope:`) and asserts the excerpt now includes that text — the literal exit-condition requirement.
> - All pre-existing fixture-based tests (Branch/Priority/Complexity tier/Blocked on/Gated on/Scope, including T-165's long/short/no-Branch-no-Scope cases) are unmodified and pass (17/17), as does `apps/server/src/routers/board.test.ts` (1/1). Typecheck clean.
>
> **Pattern/rule check** — diff is confined to the two named context files; no router/schema/caching/`deriveStatus` changes, matching Out of scope. No scope creep found.
>
> **Minor observation (not blocking)** — the new regression test's fixture is short enough that the assertion alone can't distinguish "boundary correctly stops before `Out of scope:`" from "boundary is broken and never stops at all" — though boundary-stop correctness is independently proven by the pre-existing `TICKET_WITH_LONG_SCOPE`/`TICKET_WITH_SHORT_SCOPE` fixtures, which remain unmodified and passing. Worth a one-line strengthening (e.g. asserting the excerpt does *not* contain `"Nothing relevant"`), but not a functionality gap.
>
> No test theater, no pattern deviation, no scope creep, no functionality gap against the ticket's Scope/Exit condition.
>
> PASS-WITH-NOTES

## Efficiency notes

Straightforward S-tier ticket — both context files were small (216 + 318 lines) and the ticket body already named the exact bug and the exact allowlist to use, so no exploratory reading beyond the two named files and `TICKET_SPEC.md`'s field-format block (needed to confirm the full field list/order, since the ticket's given allowlist deliberately omits `Branch`, `Scope`, and `Exit condition` and I wanted to confirm that was intentional rather than an oversight before coding around it — it lines up with `Branch`/`Scope` being the two fields this ticket explicitly unifies into the same mechanism, and `Exit condition` not currently being read by any `TicketCard` field). One design decision worth flagging: single-line fields (`Priority`, `Complexity tier`, `Blocked on`, `Gated on`, `Branch`) still only read the *first line* of their allowlist-bounded raw span rather than the whole span — this preserves exact byte-for-byte output parity with the old per-line regex on every existing fixture, since a single-line field's raw span can spill onto trailing blank lines with nothing to stop it short of the next real field. Documented in `Docs/IMPLEMENTATION_NOTES.md` § T-179.

**Retry log:** 0 retries. Red step (new failing test against the pre-fix code) confirmed the bug for the right reason on the first attempt; Green step (allowlist + `parseAllFields` + `singleLineValue`/`scopeExcerptValue`) passed the full suite (17/17 in `board.service.test.ts`, 990/990 repo-wide) on the first implementation pass with no lint/typecheck fixes needed.

## Anything Alex must decide

None. No 🧠 gate encountered. One scope note: the ticket's own given field-name allowlist omits `Exit condition` (a real `TICKET_SPEC.md` top-level field) — implemented exactly as the ticket specified rather than expanding the list, since no current `TicketCard` field reads `Exit condition`'s value and doing so wasn't in scope. If a future ticket ever needs `board.service.ts` to parse or bound on `Exit condition:`, `TOP_LEVEL_FIELDS` (`packages/core/src/services/board.service.ts`) is the one place to add it.
