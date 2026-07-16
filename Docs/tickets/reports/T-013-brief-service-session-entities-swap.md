# T-013 — `brief.service.ts`: read "Likely NPCs" from `session_entities` instead of re-deriving spans

**Outcome:** shipped
**Branch:** claude/admiring-heisenberg-l91cvf (harness-pinned session branch; ticket's nominal `feat/m-mcp/t-013-brief-service-session-entities-swap` could not be used — see "Anything Alex must decide")
**Diff:** 3 files changed, 95 insertions(+), 36 deletions(-)

## What shipped

`brief.service.ts`'s "Likely NPCs" section now reads confirmed entity links directly from the `session_entities` join table (populated by `confirm_log_session`) instead of re-running `entityService.detectSpans` against each recent session's content on every `prep_brief` call. Same output shape, same most-recent-session-wins dedupe, no fallback to text re-scanning.

## Test evidence

```
$ pnpm --filter @questlog/server test -- brief.service

 RUN  v3.2.4 /home/user/QuestLog/apps/server

 ✓ src/services/brief.service.test.ts (10 tests) 116ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
```

```
$ pnpm lint
   • Packages in scope: @questlog/mcp, @questlog/server, @questlog/shared, @questlog/web
@questlog/shared:lint: Checked 13 files in 19ms. No fixes applied.
@questlog/mcp:lint: Checked 16 files in 28ms. No fixes applied.
@questlog/server:lint: Checked 73 files in 164ms. No fixes applied.
@questlog/web:lint: Checked 158 files in 171ms. No fixes applied.
 Tasks:    4 successful, 4 total
```

```
$ pnpm typecheck
   • Packages in scope: @questlog/mcp, @questlog/server, @questlog/shared, @questlog/web
 Tasks:    4 successful, 4 total
```

```
$ pnpm test
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  20 passed (20)
@questlog/server:test:  Test Files  30 passed (30)
@questlog/server:test:       Tests  243 passed (243)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
 Tasks:    3 successful, 3 total
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above; every package passes.
- **`grep -c "detectSpans" apps/server/src/services/brief.service.ts` returns 0** — verified: `0`.
- **both existing "likely NPCs" tests in `brief.service.test.ts` pass after being updated to seed via `sessionService.linkEntities`** — both updated (`brief.service.test.ts:151-186`, `:188-211`), both pass.
- **new test: a session whose content textually mentions an NPC's name but has zero `session_entities` rows produces no entry in `likelyNpcs`** — added (`brief.service.test.ts:213-228`, "excludes an entity textually mentioned but never linked via session_entities"), passes; this is the test that failed red before the implementation change (confirmed `detectSpans`-based fallback was actually removed, not just untested).
- **the existing `prep_brief` suite in `apps/mcp/src/server.test.ts` passes unmodified** — **not met as literally stated**. That suite's existing "returns previously-on text and the mentioned NPC under likely NPCs" test creates its session the same way the two `brief.service.test.ts` tests did before this ticket (`sessionService.create`/`finalize`, no entity link) and broke under the new session_entities-only read path. This exit-condition bullet directly conflicts with the ticket's own Out-of-scope bullet ("no fallback to `detectSpans`... do not reintroduce `detectSpans` as a safety net") — satisfying both literally is impossible. Resolved by adding one `sessionService.linkEntities` call to that test (mirroring what `confirm_log_session` does in production) so the suite passes under the *intended* behavior rather than reintroducing the fallback. See "Anything Alex must decide."

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim:

> ### Scope compliance
> `apps/server/src/services/brief.service.ts:105-149` — correctly replaces the `detectSpans` re-derivation with a direct `session_entities` ⋈ `entities` query filtered to `recentSessionIds` and `type = 'npc'`, no `matchType` filtering (matches the ticket's claim that only `confirmed` spans are ever persisted — verified via `apps/mcp/src/tools/log-session.ts:34-35,68-69` and `confirm-log-session.ts:69-72`, which only pass `entityLinks.confirmed` into `linkEntities`). Dedup-by-most-recent-session logic (`npcsBySessionRecency`, newest-first iteration) and `quickLinks` derivation (`brief.service.ts:163-166`) are preserved unchanged. `LikelyNpc` shape (`brief.service.ts:28-33`) is untouched. `entityService` import removed (`brief.service.ts:1-4`), confirming no stray fallback path remains.
>
> ### Out-of-scope compliance
> - `grep -c "detectSpans" apps/server/src/services/brief.service.ts` → `0`, confirmed.
> - "Previously on" and "Active plot threads" sections are byte-identical to `develop`.
> - `entityService.detectSpans` / `sessionService.linkEntities` themselves are untouched.
> - `apps/mcp/src/tools/prep-brief.ts` is not in the diff — tool wrapper untouched as required.
>
> ### Test quality
> Both pre-existing tests updated to seed via `sessionService.linkEntities(db, session.id, [...])` with `matchType: "confirmed"`, matching the real write path rather than mocking it away. New test... is exactly the exit condition's required proof that the swap reads the join table rather than falling back to text matching. Real content assertions throughout, not `toBeDefined()` theater.
>
> ### The `apps/mcp/src/server.test.ts` edit
> ...This is the correct minimal fix and not scope creep: the alternative (leaving the test broken, or reintroducing a `detectSpans` fallback to keep it passing) would either violate CI-gating or directly violate the ticket's explicit Out-of-scope bullet. The ticket's own exit-condition bullet... is internally inconsistent with its own Scope/Out-of-scope — that's a ticket-authoring defect, not an executor error.
>
> ### Gaps found
> - No `CHANGELOG.md` entry under `[Unreleased]` for T-013 ... unmet.
> - No `Docs/IMPLEMENTATION_NOTES.md` update documenting the non-obvious decision to touch `apps/mcp/src/server.test.ts` outside the ticket's listed Context files.
> - No morning report found under `Docs/tickets/reports/` for T-013.
>
> None of these are functional gaps, scope creep, or test theater — the code change itself is a clean, complete, minimal implementation... The missing CHANGELOG/IMPLEMENTATION_NOTES entries are process-completeness misses against the ticket's explicit Definition of Done.

The three process-completeness gaps the reviewer flagged (CHANGELOG, IMPLEMENTATION_NOTES, this report) were addressed after the review — this report, the `CHANGELOG.md` entry under `T-013`, and an `IMPLEMENTATION_NOTES.md` section were all added post-review as part of Step 7, not re-reviewed.

## Anything Alex must decide

- **Ticket-authoring defect**: T-013's exit condition ("the existing `prep_brief` suite in `apps/mcp/src/server.test.ts` passes unmodified") contradicts its own Out-of-scope section (no `detectSpans` fallback). Worth fixing in `ticket-writer`'s process — cross-check exit conditions against out-of-scope bullets, or explicitly call out any test file outside the Context files list that a scope change is known to affect.
- **Branch deviation**: this session's harness-pinned branch, `claude/admiring-heisenberg-l91cvf`, was used instead of the ticket's nominal `feat/m-mcp/t-013-brief-service-session-entities-swap`, per `EXECUTOR_ROUTINE.md` Step 2's documented fallback. That branch already existed on `origin` but was confirmed (`git merge-base --is-ancestor`) to be a stale pure ancestor of `develop` with no unique work, so it was reset to this ticket's work and pushed under the enforced name — same treatment the outer harness instructions specify for an already-merged designated branch. The repo's `rename-ticket-branch.yml` workflow should rename it to the ticket's nominal name automatically once this PR is opened against `develop`.
- No 🧠 strategy gates in this ticket.
