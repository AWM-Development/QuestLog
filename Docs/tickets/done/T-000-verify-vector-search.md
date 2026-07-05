# T-000 — Verify vector search end-to-end

Milestone ref: M-MCP.0 (`Docs/MILESTONES_V1_MCP.md`)

Branch: feat/m-mcp/verify-vector-search

Context files (load ONLY these):
  - Docs/AUDIT_2026-07.md §2.3 deep-dive and §upload-trigger caveat
  - Docs/MILESTONES_V1_MCP.md — M-MCP.0 section
  - apps/server/src/server.ts — upload endpoint + `BuildAppOptions` + onReady hook
  - apps/server/src/main.ts
  - apps/server/src/services/import.service.ts
  - apps/server/src/services/source.service.ts
  - apps/server/src/services/search.service.ts
  - apps/server/src/services/search.service.test.ts
  - apps/server/src/services/chunking.service.ts (chunk boundary rules, for fixture design)
  - apps/server/src/services/voyage.client.ts (dev-mode guard when `VOYAGE_API_KEY` is unset)
  - apps/server/src/server.upload.test.ts
  - apps/server/src/db/test-helpers.ts
  - apps/server/src/db/migrate.ts (repo-root `.env` loading pattern to mirror)

Mockup: none

Model: sonnet

Scope:
  1. Fix the upload-trigger gap (audit §upload-trigger caveat): add an opt-in
     `autoProcessUploads?: boolean` (default `false`) to `BuildAppOptions`. When
     `true`, the upload handler fires `importService.processSource(db, storage,
     source.id)` (not awaited — response still returns immediately) after
     `setStorageKey`. Wire `main.ts` to pass `autoProcessUploads: true` so the
     real server auto-processes uploads without a restart. Default stays `false`
     so existing upload/multipart tests are unaffected (see Out of scope).
  2. Add a deterministic fixture: `apps/server/src/test-fixtures/ashfall-primer.md`
     — 3 short `##`-headed sections, each a distinct, unambiguous topic (per
     `chunking.service.ts` boundary rules, each heading becomes its own chunk).
     This fixture is permanent — future tickets reuse it as the smoke-test
     backbone rather than each inventing their own.
  3. Add `apps/server/src/services/search.e2e.test.ts` — the real (non-mocked)
     retrieval proof: builds the app with `autoProcessUploads: true`, uploads
     the fixture via a real multipart POST, polls source status until `done`
     (bounded — fail the test on timeout, not hang), then calls
     `search.searchSources` (via `app.inject`, real tRPC path) with 2+ queries
     targeting 2 different fixture sections and asserts the expected section's
     content is the top-ranked result for each. Uses the real Voyage API — load
     `VOYAGE_API_KEY` from repo-root `.env` the same way `migrate.ts` does
     (`dotenv.config({ path: "../../.env" })`, which does not override an
     already-set env var, so CI's workflow-injected `VOYAGE_API_KEY` still wins
     there). Guard the whole suite with `it.skipIf(!process.env.VOYAGE_API_KEY)`
     so a fork/environment without the key skips cleanly instead of failing.
  4. Headless-readiness probe: confirm (by actually running them, not by
     inspection) that `docker compose up -d` + `pnpm --filter @questlog/server
     db:migrate` + `pnpm test` succeed non-interactively in a clean shell with
     no other manual steps, and record the exact invocation in
     `Docs/IMPLEMENTATION_NOTES.md` for a future scheduled/nightly run to use.

Out of scope:
  - Do not make `autoProcessUploads` default to `true`. Every existing
    upload/multipart test calls `buildApp({ db, storage })` with no override;
    flipping the default would make ~10 unrelated tests start hitting the real
    Voyage API on every run (slow, network-dependent, cost — exactly what
    `.claude/rules/backend.md`'s mocking rule exists to prevent). If this
    surprises you, that's the point of this note.
  - Do not touch `processPendingSources` / the `onReady` startup-drain hook —
    it stays as a second, independent processing path (e.g. for sources
    uploaded while the server was down).
  - Do not implement OCR (2.4) or anything else 🧠-gated.
  - Do not build a UI for search — the tRPC endpoint is debug-only per the
    original milestone intent and stays that way; `apps/mcp` (M-MCP.1) is the
    real consumer, not in scope here.
  - Do not change `chunking.service.ts` or `search.service.ts` logic — both are
    already correct per the audit; this ticket proves them against real data,
    it doesn't modify them.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - `search.e2e.test.ts` (real Voyage API): for query targeting the "Mira
    Duskwood" section, the top search result's content contains "Duskwood";
    for a query targeting the "Sleeping Griffon" section, the top result
    contains "Oskar" or "Griffon" — and neither top result is the dragon
    section for either query (a real, asserted discrimination, not just "some
    result came back")
  - a real multipart upload against a running app (`autoProcessUploads: true`)
    reaches `status: "done"` without any manual call to `processPendingSources`
    or `process-imports` — proven by the polling assertion in the same test
  - `docker compose up -d && pnpm --filter @questlog/server db:migrate && pnpm test`
    run back-to-back in a clean shell, documented verbatim in
    `Docs/IMPLEMENTATION_NOTES.md`, exit 0

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_MCP.md (M-MCP.0
  → done, 2.3 → done in the M2 table), IMPLEMENTATION_NOTES.md updated
  (headless-readiness invocation + the `autoProcessUploads` opt-in decision +
  the new `.e2e.test.ts` naming convention for real-API tests), morning report
  written to Docs/tickets/reports/T-000-verify-vector-search.md.
