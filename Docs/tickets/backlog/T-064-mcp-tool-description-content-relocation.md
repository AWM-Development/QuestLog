# T-064 — Relocate MCP tool description strings into `packages/mcp/src/content/`

Milestone ref: none — pipeline/tooling hygiene, same category as T-027/T-043/T-052/T-060/T-061/T-062/T-063. Direct follow-up requested by Alex after T-033 introduced `packages/mcp/src/content/onboarding-instructions.ts` as a home for static text returned verbatim to the model: every `tools/*.ts` file also carries its own inline `description:` string literal passed to `server.registerTool(...)`, which is the same category of asset (static text a client/model reads, not registration logic) scattered across every tool file instead of centralized. This extends the same organizational pattern T-033 started to those strings.

Priority: P1

Blocked on: T-033 — must be merged into develop first

Branch: chore/pipeline/t-064-mcp-tool-description-content-relocation

Context files (load ONLY these):
  - packages/mcp/src/content/onboarding-instructions.ts (the pattern to extend — single exported `UPPER_SNAKE_CASE` constant per static text asset)
  - packages/mcp/src/tools/query-lore.ts
  - packages/mcp/src/tools/prep-brief.ts
  - packages/mcp/src/tools/list-campaigns.ts
  - packages/mcp/src/tools/list-entities.ts
  - packages/mcp/src/tools/get-entity.ts
  - packages/mcp/src/tools/create-entity.ts
  - packages/mcp/src/tools/append-entity-note.ts
  - packages/mcp/src/tools/log-session.ts
  - packages/mcp/src/tools/confirm-log-session.ts
  - packages/mcp/src/tools/ingest-text.ts
  - packages/mcp/src/tools/get-source-status.ts
  - packages/mcp/src/tools/help.ts (added by T-033 — confirm it exists on `develop` before starting; if it doesn't, T-033 hasn't actually merged yet despite this ticket's auto-promotion, and that's a signal to stop and flag rather than proceed without it)
  - .claude/rules/mcp.md (the "File organization" section this ticket must update to document the new convention)

Mockup: none

Model: sonnet

Scope:
  Pure text relocation, no behavioral change:

  1. Create `packages/mcp/src/content/tool-descriptions.ts`, exporting one
     `UPPER_SNAKE_CASE` string constant per tool's `description` value
     (e.g. `QUERY_LORE_DESCRIPTION`, `LIST_CAMPAIGNS_DESCRIPTION`),
     named after the tool, holding the exact existing text verbatim —
     no rewording.
  2. Update each of the 12 tool files listed above so its
     `server.registerTool(...)` call imports and references its constant
     from `content/tool-descriptions.ts` instead of an inline string
     literal.
  3. Update `.claude/rules/mcp.md`'s "File organization" section to
     document the new convention: a tool's `description` text lives in
     `content/tool-descriptions.ts`, not inlined in its `register*`
     function — the `register<ToolName>(server, deps)` shape and
     one-file-per-tool rule for registration logic are otherwise
     unchanged.
  4. Record the decision (one content file per asset *type* — one
     aggregated `tool-descriptions.ts` for all tool descriptions, not
     one file per tool — vs. `onboarding-instructions.ts`'s one-file-per-asset
     pattern) in `Docs/IMPLEMENTATION_NOTES.md`, since it's a non-obvious
     choice a future ticket adding a 13th tool needs to follow correctly.

Out of scope:
  - No rewording of any description's text — verbatim relocation only.
  - No change to any tool's `inputSchema`, Zod validation, or handler
    logic.
  - No further splitting of `content/` into per-tool description files —
    one aggregated `tool-descriptions.ts` for now; only reconsider if it
    grows unwieldy, and that's a future call, not this ticket's.
  - No changes to `apps/mcp-stdio` or `apps/server`'s MCP HTTP routes —
    those only consume the server's tool list, unaffected by where a
    description string's source file lives.
  - No changes to `onboarding-instructions.ts` itself or its `help`
    tool's behavior (already relocated as part of T-033's own PR).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary
  - `grep -L "content/tool-descriptions" packages/mcp/src/tools/*.ts`
    (excluding `errors.ts` and `types.ts`, which aren't tools) returns
    nothing — every tool file imports from the new module
  - `packages/mcp/src/server.test.ts`'s existing tests (tool-list
    contents, individual tool behavior) still pass unmodified, proving
    the relocation changed no observable behavior
  - `apps/server/src/routes/mcp-http.routes.integration.test.ts`'s
    `EXPECTED_TOOLS`/tool-count assertion still passes unmodified

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: no milestone checkbox to flip (see Milestone ref
  above), `IMPLEMENTATION_NOTES.md` updated per Scope item 4, `.claude/rules/mcp.md`
  updated per Scope item 3, a `CHANGELOG.md` entry under `[Unreleased]`
  (tooling/dev-experience, not user-facing), morning report written.
