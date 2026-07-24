# T-031 — `ingest_text` MCP tool (write, immediate — not preview/confirm)

Milestone ref: M-REMOTE.4 (`Docs/MILESTONES_V1_1_MCP.md`)

Branch: feat/m-remote/t-031-mcp-ingest-text-tool

Context files (load ONLY these):
  - apps/server/src/mcp/tools/log-session.ts (closest existing write-tool pattern, though log_session uses preview/confirm — read this to understand why, then see Scope below for why ingest_text does not)
  - apps/server/src/mcp/tools/query-lore.ts (the read-tool pattern to mirror for response shape)
  - apps/server/src/mcp/tools/types.ts (`ToolDeps`)
  - apps/server/src/mcp/server.ts (one-line registration)
  - apps/server/src/services/source.service.ts (`createFromText` — already exists)
  - apps/server/src/services/import.service.ts (`processSource` — the pipeline this tool must actually trigger, unlike the existing `source.importText` tRPC mutation)
  - apps/server/src/routers/source.ts (`importText` mutation — the existing but non-auto-processing path this tool improves on)
  - apps/server/src/server.ts (`autoProcessUploads` — the fire-and-forget pattern to mirror, since embedding can take longer than a single tool-call round trip should block on)
  - .claude/rules/mcp.md (preview/confirm applies to mutations of existing data, not additive-only writes — resolved by G-001; ingest_text is additive-only, so it's exempt)

Mockup: none

Model: sonnet

Scope:
  Today, seeding a campaign's knowledge base from inside a Claude session
  is impossible — the only ingestion path is `POST /api/campaigns/:id/sources/upload`,
  a REST multipart endpoint no MCP tool wraps. Add `ingest_text`: given a
  `campaignId`, a `title`, and `content` (plain text or markdown pasted
  directly into the chat), create a source via `sourceService.createFromText`
  and kick off `importService.processSource` the same way the REST upload
  endpoint's `autoProcessUploads` path does (fire-and-forget — return
  immediately with the source's `pending` status and id, don't block the
  tool call on embedding completing).

  **Why this is a direct write, not preview/confirm like `log_session`:**
  Per G-001's resolution (`.claude/rules/mcp.md`), preview/confirm applies
  to tools that mutate *existing* records — `log_session` needs it because
  its entity-consolidation step appends to entity records that already
  exist. `ingest_text` only ever creates a brand-new `sources` row plus new
  `chunks` rows; it never mutates or deletes anything that existed before
  the call, so it's a direct write, confirmed decision, not a fallback
  pending review.

  Also add a way to check on ingestion status after the fact: either a
  second small tool (`get_source_status`) or extend an existing read tool
  — decide based on what's smaller; a DM will want to confirm "is my
  upload done processing" before querying for it.

Out of scope:
  - No binary file upload support (PDF, DOCX) — MCP tool inputs are
    structured JSON, and Claude Desktop/Claude.ai don't have a
    file-attachment-to-tool-call path today. Text/markdown pasted as a
    string is the only input shape. Binary upload over MCP (if ever
    wanted) is new scope for a future ticket, not this one.
  - No changes to the existing REST upload endpoint or `source.importText`
    tRPC mutation — this is a new, additive path.
  - No entity extraction/auto-linking from ingested text — that's
    `log_session`'s job for session content; `ingest_text` is pure
    knowledge-base ingestion, same as the web app's SourcesPage flow.
  - No duplicate-detection UX (the REST path's `checkDuplicate`/
    `resolveDuplicate` flow) — out of scope for a first version; flag as a
    possible follow-up if it comes up during testing.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - new suite in `apps/server/src/mcp/server.test.ts` (or a new file
    following the same pattern): calling `ingest_text` with real content
    against a seeded test campaign produces a source that reaches `status:
    "done"` (poll or await the same way `search.e2e.test.ts` does for the
    REST path) with a real embedded chunk
  - a subsequent `query_lore` call against the same campaign, with a query
    the ingested content actually answers, returns that content in its
    citations
  - the status-check path (whatever form it takes) correctly reports
    `pending`/`done`/`error` for a source

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-REMOTE.4 in
  `Docs/MILESTONES_V1_1_MCP.md`, `IMPLEMENTATION_NOTES.md` updated if the
  preview/confirm exemption reasoning above needed correcting, a
  `CHANGELOG.md` entry under `[Unreleased]`, morning report written.
