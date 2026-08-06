# T-138 — Tool-description naming & length/format consistency pass

Milestone ref: Docs/milestones/MILESTONES_V1_5_MCP.md, M-POLISH.1

Complexity tier: S

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-polish/t-138-tool-description-consistency-pass

Context files (load ONLY these):
  - packages/mcp/src/content/tool-descriptions.ts
  - packages/mcp/src/content/tool-descriptions.test.ts
  - .claude/rules/mcp.md

Mockup: none

Model: sonnet

Scope: Audit every exported description constant in `tool-descriptions.ts`
  for two concrete drifts and fix both:
  1. **"Direct write" label placement.** `CREATE_CAMPAIGN_DESCRIPTION` and
     `APPEND_ENTITY_NOTE_DESCRIPTION` place "Direct write — ..." immediately
     after the first sentence. `CREATE_ENTITY_DESCRIPTION` places it at the
     very end, after the lore-matching explanation. Standardize every
     direct-write tool to the first-sentence-then-label placement.
  2. **"Returns ..." clause presence.** `CREATE_CAMPAIGN_DESCRIPTION` and
     `CREATE_ENTITY_DESCRIPTION` state exactly what fields/shape the tool
     returns; `APPEND_ENTITY_NOTE_DESCRIPTION`, `ARCHIVE_ENTITY_DESCRIPTION`,
     `CONFIRM_ARCHIVE_ENTITY_DESCRIPTION`, `UNARCHIVE_ENTITY_DESCRIPTION`,
     `CONFIRM_UNARCHIVE_ENTITY_DESCRIPTION`, and `GET_SOURCE_STATUS_DESCRIPTION`
     don't. Decide and apply one convention: every tool description that
     isn't a pure preview (i.e. every tool whose response the calling model
     actually needs to inspect field-by-field) ends with a "Returns ..."
     clause naming the returned shape.
  Add new assertions to `tool-descriptions.test.ts` that lock in both
  patterns across the full exported set, so a future tool addition that
  drifts from either convention fails a test instead of silently landing.

Out of scope: no changes to the interaction-philosophy content T-101 already
  retrofit (confirmation-narration, proactive-status-checking, error-tone
  language stays exactly as-is); no renaming of tool identifiers themselves
  (the `server.registerTool` name strings in `packages/mcp/src/tools/*.ts`);
  no changes to `ONBOARDING_INSTRUCTIONS` or any other content file.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - every "Direct write" description in `tool-descriptions.ts` places the
    label in the same position (first sentence, then the label, then any
    elaboration) — verified by the new test
  - every non-preview-only description ends with a "Returns ..." clause —
    verified by the new test

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_5_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
