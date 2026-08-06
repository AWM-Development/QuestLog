# T-101 — Retrofit existing tools to the new agent-interaction policy

Milestone ref: M-INTERACT.2 (`Docs/milestones/MILESTONES_V1_4_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-interact/t-101-retrofit-tool-descriptions-interaction-philosophy

Context files (load ONLY these):
  - .claude/rules/mcp.md (T-100's new policy section — the rules this ticket audits every write-tool description against)
  - packages/mcp/src/content/tool-descriptions.ts (every write-tool description constant this ticket reviews and updates)
  - packages/mcp/src/content/onboarding-instructions.ts (already carries the error-tone sentence from T-100 — read only, no changes expected here)
  - .claude/rules/mcp.md's "Campaign-scoped ID lookups" and "Write tools" sections (existing conventions the retrofit must not contradict)

Mockup: none

Model: sonnet

Scope: Audit every write-tool description in `packages/mcp/src/content/tool-descriptions.ts` — `CREATE_CAMPAIGN_DESCRIPTION`, `CREATE_ENTITY_DESCRIPTION`, `APPEND_ENTITY_NOTE_DESCRIPTION`, `UPDATE_ENTITY_DESCRIPTION`/`CONFIRM_UPDATE_ENTITY_DESCRIPTION`, `LOG_SESSION_DESCRIPTION`/`CONFIRM_LOG_SESSION_DESCRIPTION`, `INGEST_TEXT_DESCRIPTION`, `CORRECT_LORE_DESCRIPTION` — against T-100's confirmation-narration and proactive-status-checking rules in `.claude/rules/mcp.md`. Update any description missing the required guidance:
  - Every `*_DESCRIPTION` for a tool with a paired `confirm_*` tool (`update_entity`, `log_session`, `correct_lore`) must instruct the model to summarize the proposed change to the user before calling its confirm counterpart.
  - Any description for a tool starting async background work must instruct proactive status-polling and narration, matching `ingest_text`'s existing pattern (which already complies and needs no substantive change).
  `ONBOARDING_INSTRUCTIONS` is out of scope here — T-100 already added the error-tone sentence there.

Out of scope: changing tool behavior, input schemas, or the underlying services — this ticket only edits description strings. No new tools. No changes to `.claude/rules/mcp.md` itself (that's T-100, already merged).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - every `*_DESCRIPTION` constant identified in Scope for a `confirm_*`-paired tool contains explicit narrate-before-confirm language (grep-checkable, e.g. a phrase instructing the model to tell/summarize/narrate to the user before calling the matching `confirm_*` tool)
  - no `*_DESCRIPTION` constant's preview/confirm mechanics description regresses (existing token/preview-payload language stays intact)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_4_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
