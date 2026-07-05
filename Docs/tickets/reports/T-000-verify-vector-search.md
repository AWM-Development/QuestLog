# T-000 — Verify vector search end-to-end

**Outcome:** shipped
**Branch:** feat/m-mcp/verify-vector-search
**Diff:** 7 files changed, +366/-13 lines

## What shipped

Two things the Phase 0 audit found broken are now fixed and *proven* fixed with real data, not just code review: (1) uploading a file to a running server previously never triggered processing — it sat at `pending` forever until a restart — and (2) vector search retrieval had never been demonstrated end-to-end with real embeddings; every prior test mocked the embedding layer, and the dev DB had 0 chunks.

## Test evidence

Full workspace suite, run back-to-back per the headless-readiness sequence:

```
$ docker compose up -d
 Container questlog-postgres-1  Running

$ DATABASE_URL=postgresql://questlog:questlog@localhost:5433/questlog_test pnpm --filter @questlog/server db:migrate
Migrations complete.

$ pnpm build
 Tasks:    2 successful, 2 total
  Time:    5.888s

$ pnpm lint
 Tasks:    3 successful, 3 total

$ pnpm typecheck
 Tasks:    3 successful, 3 total

$ pnpm test
 ✓ src/services/search.e2e.test.ts (1 test) 698ms
   ✓ search — real end-to-end retrieval (T-000) > returns the semantically relevant chunk for distinct queries against the fixture  694ms
 ✓ src/server.auto-process-upload.test.ts (2 tests) 262ms
 ... (25 more files)
 Test Files  27 passed (27)
      Tests  202 passed (202)
```

## Exit condition check

- All tests green, typecheck clean, lint clean — shown above.
- `search.e2e.test.ts` (real Voyage API): asserts the "Mira Duskwood" query's top result contains `"Duskwood"` and explicitly does **not** contain `"Pyrraxes"` (the dragon section); the "Sleeping Griffon" query's top result contains `"Oskar"` or `"Griffon"` and also not `"Pyrraxes"` — real, asserted discrimination between three distinct topics via real embeddings, not "some result came back."
- Real multipart upload with `autoProcessUploads: true` reaches `status: "done"` with no manual `processPendingSources`/`process-imports` call — proven by the polling assertion in the same test (`apps/server/src/services/search.e2e.test.ts:99-100`) and separately, with a mocked embed fetch, in `apps/server/src/server.auto-process-upload.test.ts:90-120`.
- `docker compose up -d && db:migrate && pnpm test` run in a clean sequence, documented verbatim in `Docs/IMPLEMENTATION_NOTES.md §Headless-readiness invocation`, exit 0.

## Reviewer verdict

**PASS-WITH-NOTES** (full agent output below, condensed)

> Scope delivery (items 1–4): all four delivered — `autoProcessUploads` wiring matches spec exactly; fixture has three distinct unambiguous sections; `search.e2e.test.ts` delivers real upload + polling + real tRPC path + two-query discrimination + key-absence skip guard; headless-readiness sequence documented.
>
> Test quality — real proof, not theater. [`search.e2e.test.ts:117-129`] asserts positive AND negative containment per query — exactly the discrimination the Exit condition demands. [`server.auto-process-upload.test.ts:90-148`] positive/negative wiring cases both legitimate.
>
> No scope creep found. `chunking.service.ts`, `search.service.ts`, and the `onReady`/`processPendingSources` path are untouched; no OCR, no UI.
>
> Connection/transaction risk (explicitly asked about) — checked, no defect found. Verified `import.service.ts`/`source.service.ts`/`embedding.service.ts` never call `db.transaction()`, so the fire-and-forget `processSource` on the same `max: 1` test connection has no nested-`BEGIN` conflict; postgres-js's single-connection FIFO queue makes the interleaving safe.
>
> Documentation nit: `search.e2e.test.ts`'s header comment references `search.integration.test.ts` as a peer test tier — reviewer claimed no such file exists.
>
> Definition-of-done gap: ticket not yet moved to `done/`, report not yet written.

**Two follow-ups on the review, both resolved without code changes:**
1. The "documentation nit" is a **false positive** — `apps/server/src/routers/search.integration.test.ts` exists and does exactly what the comment describes (mocks `searchService.search` entirely via `vi.spyOn`, confirmed at lines 53 and 108 of that file). The reviewer appears to have only checked the `services/` directory. Verified directly; no change made.
2. The "definition-of-done gap" is expected sequencing, not a defect — per `.claude/agents/reviewer.md` and `TICKET_SPEC.md`, the reviewer runs as the *final act before* writing this report and moving the ticket to `done/`. Both are completed immediately after this review, in this same session.

No remediation pass was needed — nothing in the review identified an actual code or test defect.

## Anything Alex must decide

- **Voyage account rate limit.** The dev `VOYAGE_API_KEY` account is on the free tier — 3 RPM without a payment method. `search.e2e.test.ts` alone uses 3 real requests per run, so re-running it (or anything else hitting Voyage for real) twice within ~60s will 429. Not a code defect — recommend adding a payment method at the [Voyage dashboard](https://dashboard.voyageai.com/) to unlock standard limits. Documented in `Docs/IMPLEMENTATION_NOTES.md §Embedding`; deliberately not worked around with retry/backoff logic in code.
- No 🧠-gated checkpoint was skipped — 2.4 (OCR) was never in this ticket's scope.
- New test-tier convention introduced: `.e2e.test.ts` (real DB + real external API, `skipIf`-gated), alongside the existing `.test.ts` / `.integration.test.ts` tiers. Documented in `IMPLEMENTATION_NOTES.md` — worth folding into `.claude/skills/tdd-loop/SKILL.md` next time that skill is touched, but not done here (out of this ticket's scope).
