# T-065 — `ingest_text`: multi-call chunked ingestion + attachment/status-polling guidance

Milestone ref: M-REMOTE.8 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Priority: P1

Branch: feat/m-remote/t-065-ingest-text-chunked-ingestion-and-attachment-guidance

Context files (load ONLY these):
  - packages/shared/src/validators/mcp.ts (`IngestTextInput`, `GetSourceStatusInput` — the schema to extend)
  - packages/core/src/services/source.service.ts (`createFromText` stores pasted content in `metadata.content`; needs a companion append method)
  - packages/core/src/services/import.service.ts (`processSource` — chunks + embeds; must only fire once, on the final chunk)
  - packages/mcp/src/tools/ingest-text.ts
  - packages/mcp/src/tools/get-source-status.ts
  - packages/mcp/src/content/onboarding-instructions.ts (shared text `help` + connection `instructions` both read from)
  - .claude/rules/mcp.md ("Write tools" section — this stays additive-only, no preview/confirm needed per G-001's resolution, since appending un-persisted chunks to a still-`pending` source is not a mutation of existing *processed* data)

Mockup: none

Model: sonnet

Scope:
  Resolves G-005's Q1 (large-document ingestion) and Q3 (status-polling
  guidance) together — both are text/behavior additions to the same tool.

  1. **Chunked ingestion.** A DM can attach a large document (PDF/DOCX/
     image) directly to the Claude conversation; Claude reads it natively
     and can pass its extracted text to `ingest_text` — but a single tool
     call requires the model to regenerate the entire document as output
     tokens for one JSON argument, which is impractical for long documents
     (slow, costly, risks truncation well below any actual size limit).
     Add multi-call support:
     - `IngestTextInput` gains two optional fields: `sourceId` (append to
       an existing pending source instead of creating a new one) and
       `final` (boolean, default `true` — when `false`, skip triggering
       `importService.processSource` after this call).
     - `sourceService` gains an `appendContent(db, sourceId, content)`
       method that concatenates onto the existing `metadata.content`
       string of a `pending`-status source (throw if the source isn't
       `pending` — processing must not have started yet).
     - `ingest_text`'s handler: if `sourceId` is absent, behaves exactly as
       today (create + process, unless `final: false`, in which case it
       creates but does not trigger processing). If `sourceId` is present,
       append instead of create; still only triggers processing when
       `final` is `true` (or omitted). Response always echoes back
       `source.id` so the model can chain subsequent calls.
  2. **Attachment guidance.** Update `ingest_text`'s tool description and
     `ONBOARDING_INSTRUCTIONS` to tell the model: when the user attaches a
     document to the conversation, extract its text and call `ingest_text`
     directly — do not ask the user to paste it manually. For a long
     document, split it across multiple `ingest_text` calls using
     `sourceId`/`final` rather than one call with the whole text.
  3. **Status-polling guidance.** Update `ingest_text`'s description to
     explicitly instruct the model to proactively re-call
     `get_source_status` after ingestion (the final chunk) and narrate
     progress to the user, rather than leaving this to unguided judgment —
     resolving G-005's Q3.

Out of scope:
  - No new transport, no base64/binary tool-call argument, no MCP
    "resources" primitive — the model already receives attachment content
    natively via the Claude.ai/Desktop conversation itself, per G-005's
    resolution. This ticket only makes `ingest_text` usable across
    multiple calls for that already-extracted text.
  - No OCR or extraction-quality work (that's Milestone 2's separate,
    already-distinct scanned-document gate).
  - No change to `get_source_status`'s own behavior or schema.
  - No enforced max chunk size or max chunk count — left to model
    judgment, per the same "no guidance beyond what's stated" principle
    G-005 applied to Q3.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary
  - a test calling `ingest_text` twice with the same `sourceId` (second
    call `final: true`) results in one source whose processed content
    (post-`processSource`) contains both chunks' text, retrievable via
    `query_lore`
  - a test calling `ingest_text` with `sourceId` pointing at a non-`pending`
    source throws
  - `ONBOARDING_INSTRUCTIONS` and `ingest_text`'s description both mention
    extracting attached-document content directly and re-checking
    `get_source_status` after ingestion (assert on content, not just
    presence)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-REMOTE.8 in
  `Docs/milestones/MILESTONES_V1_1_MCP.md` (only once all of T-065/T-066/T-067
  are done — see that milestone task's note), `IMPLEMENTATION_NOTES.md`
  updated if any non-obvious decision was made, a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written.
