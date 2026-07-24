# T-033 — Onboarding surface: server `instructions` + `help` tool

Milestone ref: M-REMOTE.6 (`Docs/MILESTONES_V1_1_MCP.md`)

Branch: feat/m-remote/t-033-mcp-onboarding-surface

Context files (load ONLY these):
  - apps/server/src/mcp/server.ts (the `createMcpServer` factory — where the `McpServer` constructor is called)
  - apps/server/src/mcp/tools/list-campaigns.ts (simplest existing tool, closest pattern for `help`'s no-input shape)
  - apps/mcp/README.md (the "First conversation" section — the existing human-facing walkthrough this tool surfaces a condensed version of, in the model's own voice rather than a human reading a README)
  - `@modelcontextprotocol/sdk`'s `McpServer` constructor types (inspect `node_modules/@modelcontextprotocol/sdk/dist/**/mcp.d.ts` directly — confirm whether `instructions` is a constructor option or set some other way; do not assume the exact API shape without checking)
  - .claude/rules/mcp.md

Mockup: none

Model: sonnet

Scope:
  Two additive pieces, both read-only, no service-layer changes:

  1. **Server `instructions`** — the MCP protocol's `initialize` response
     carries an optional `instructions` field, which well-behaved clients
     (including Claude) surface to the model at connection time without
     the user having to ask. Set it on `createMcpServer`'s `McpServer`
     construction to a short summary covering the workflow Alex asked for
     explicitly: "you can upload a campaign document, start tracking a
     session, and query campaign lore" — concrete enough that a model
     seeing it for the first time knows `list_campaigns` is the starting
     point (mirroring `list_campaigns`' own tool description) and that
     `ingest_text` (T-031) and `create_entity`/`append_entity_note`
     (T-032) exist for authoring, not just the four original read tools.
  2. **`help` tool** — a no-input tool (same shape as `list_campaigns`)
     that returns the same workflow summary on demand, for a client that
     doesn't surface `instructions` automatically, or a user who wants a
     refresher mid-conversation. Keep the two text sources
     (`instructions` and `help`'s output) as one shared constant, not two
     copies that can drift.

Out of scope:
  - No MCP "prompts" primitive (a separate, more structured MCP capability
    for guided multi-step flows) — `instructions` + a `help` tool covers
    what was asked for; prompts are a bigger, separate feature surface not
    currently used anywhere in this codebase.
  - No changes to any existing tool's description text.
  - No UI of any kind — this is plain text returned through the MCP
    protocol, rendered however the client chooses.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - a scripted MCP client's `initialize` response includes a non-empty
    `instructions` field (assert its content, not just its presence —
    check it mentions `list_campaigns`, `ingest_text`, and session
    tracking)
  - calling the `help` tool returns text matching the same content

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-REMOTE.6 in
  `Docs/MILESTONES_V1_1_MCP.md`, `IMPLEMENTATION_NOTES.md` updated if any
  non-obvious decision was made, a `CHANGELOG.md` entry under
  `[Unreleased]`, morning report written.
