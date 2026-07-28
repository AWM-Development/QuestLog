# T-068 — Make campaign-scoped ID lookups a structural convention for MCP tools

Milestone ref: none — review follow-up from T-065 (`Docs/tickets/reports/T-065-ingest-text-chunked-ingestion-and-attachment-guidance.md`), not part of a milestone doc

Priority: P1

Branch: feat/mcp/t-068-campaign-scoped-id-lookups

Context files (load ONLY these):
  - packages/core/src/services/source.service.ts (`getById` — unscoped, lines ~69-81 — and `getByIdForCampaign` — scoped, lines ~83-95 — the split this ticket fixes)
  - packages/core/src/services/entity.service.ts (`getById(db, campaignId, entityId)` around line 312 — already the target convention: campaignId is a *mandatory* parameter, there is no unscoped sibling to reach for by mistake)
  - packages/core/src/services/import.service.ts (line ~67, one internal caller of `sourceService.getById` to rename)
  - apps/server/src/routers/source.ts (line ~74, one internal caller to rename)
  - apps/server/src/routers/import.ts (line ~31, one internal caller to rename)
  - packages/mcp/src/tools/ingest-text.ts (already fixed to call `getByIdForCampaign` before `appendContent` — confirm the guard test below passes against it, no further change expected here)
  - packages/mcp/src/tools/get-source-status.ts (already calls `getByIdForCampaign` correctly — reference example of the target pattern)
  - packages/mcp/src/tools/ (the full directory listing, to write the guard test's file glob — do not open every file's contents, just `ls` it)
  - .claude/rules/mcp.md ("Error shape" section area — add the new naming convention near here)
  - Docs/IMPLEMENTATION_NOTES.md § T-065 (both entries — background on why this ticket exists)

Mockup: none

Model: sonnet

Scope:
  T-065's review caught `sourceService.appendContent` reaching for
  `getById` (unscoped) instead of `getByIdForCampaign` (scoped) inside an
  MCP tool handler — fixed at that one call site, but nothing stops the
  next MCP tool handler from making the same mistake, since the two
  methods' names don't signal which is safe for untrusted external input.
  This ticket makes that mistake structurally harder to make, for
  `packages/core`'s services in general, not just `source.service.ts`:

  1. **Rename the unscoped method to make its risk visible in its name.**
     `sourceService.getById(db, id)` → `sourceService.getByIdUnscoped(db, id)`.
     Update its three existing internal callers (all trusted, non-MCP
     callers): `import.service.ts`, `apps/server/src/routers/source.ts`,
     `apps/server/src/routers/import.ts`. No behavior change — same
     query, same `NotFoundError` on miss, just a renamed export.
     `getByIdForCampaign` keeps its current name and signature unchanged.
  2. **Add a static guard test** (new file, e.g.
     `packages/mcp/src/tools/campaign-scoping.test.ts`) that reads every
     `*.ts` file in `packages/mcp/src/tools/` (excluding `*.test.ts`,
     `errors.ts`, `types.ts`) and fails if any file's source text matches
     a call to a method whose name ends in `Unscoped` (e.g. a regex like
     `/\.\w*Unscoped\s*\(/`). This is deliberately a lightweight text-scan
     guard, not a real static-analysis/lint plugin (Biome doesn't support
     custom rules) — cheap, dependency-free, and enough to catch the
     literal class of mistake this ticket is closing.
  3. **Document the convention** in `.claude/rules/mcp.md`: any
     `packages/core` service method meant to be reachable from an MCP
     tool handler with untrusted external input must take `campaignId` as
     a mandatory parameter (matching `entityService.getById`'s existing
     shape) or otherwise scope its own lookup; a service that also needs
     an unscoped variant for trusted-internal (tRPC/other-service)
     callers must suffix that variant's name with `Unscoped`, and
     `packages/mcp/src/tools/*.ts` must never call an `Unscoped` method
     directly — enforced by the guard test above, not just written
     convention.

Out of scope:
  - Do not rename or touch `entity.service.ts`'s `getById` — it already
    takes `campaignId` as a mandatory parameter and is the reference
    shape this ticket is generalizing from, not something to change.
  - Do not touch `session.service.ts`'s `getById` (unscoped, used only by
    `apps/server/src/routers/session.ts` today) — no MCP tool currently
    calls it, so there's nothing to rename yet; a future ticket adding a
    session-by-id MCP tool is responsible for either scoping it or
    suffixing it `Unscoped` per the new convention, and the guard test
    added here will already catch a violation at that point.
  - No custom ESLint/Biome plugin, no build-time AST-based enforcement —
    the text-scan guard test is the sanctioned mechanism per this
    ticket's Scope.
  - No change to `getByIdForCampaign`'s signature, `NotFoundError`
    semantics, or any other service's error handling.
  - No further audit of `apps/server`/tRPC routers for the same
    unscoped-vs-scoped split — this ticket is about the MCP tool
    boundary specifically, where the caller is untrusted external input;
    tRPC's trust model is a separate question, not addressed here.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary
  - `sourceService.getById` no longer exists; `sourceService.getByIdUnscoped`
    exists with an identical implementation, and `import.service.ts`,
    `apps/server/src/routers/source.ts`, `apps/server/src/routers/import.ts`
    all call the renamed method (grep confirms zero remaining references
    to `sourceService.getById` anywhere in the repo)
  - the new guard test passes against the current `packages/mcp/src/tools/`
    tree, and a second assertion in the same test file demonstrates it
    actually catches a violation (e.g. asserts the guard's own matcher
    function returns true against a literal string fixture containing
    `sourceService.getByIdUnscoped(db, sourceId)`, so the test isn't
    theater that would pass even with a no-op matcher)
  - `.claude/rules/mcp.md` contains the new `Unscoped`-suffix convention,
    stated as a rule an MCP tool file must follow, not just a comment

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: `IMPLEMENTATION_NOTES.md` updated if any
  non-obvious decision was made, a `CHANGELOG.md` entry under
  `[Unreleased]`, morning report written. (No milestone checkbox to flip —
  this ticket isn't tied to a milestone doc task.)
