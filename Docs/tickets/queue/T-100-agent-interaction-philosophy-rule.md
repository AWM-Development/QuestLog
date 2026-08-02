# T-100 — Write the agent-interaction policy into `.claude/rules/mcp.md`

Milestone ref: M-INTERACT.1 (`Docs/milestones/MILESTONES_V1_4_MCP.md`)

Complexity tier: S

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-interact/t-100-agent-interaction-philosophy-rule

Context files (load ONLY these):
  - .claude/rules/mcp.md (the file being extended — existing "Write tools" and "Error shape" sections set the precedent for tone/structure)
  - packages/mcp/src/content/tool-descriptions.ts (current tool descriptions — read for examples of what already exists, e.g. `ingest_text`'s status-polling instruction, `update_entity`'s confirm-token language)
  - packages/mcp/src/content/onboarding-instructions.ts (where the error-tone sentence lands — one shared text source per its own file header comment)
  - packages/mcp/src/tools/errors.ts (the `{ error: { code, message } }` shape the error-tone guidance describes)
  - Docs/tickets/gated/resolved/G-012-v1-3-interaction-philosophy-and-mcp-polish-milestone.md (this ticket's originating decision — read the `## Resolution` section)

Mockup: none

Model: sonnet

Scope: Add a new section to `.claude/rules/mcp.md` (after "Write tools — preview/confirm/audit applies to mutations..." and before or after "Error shape", whichever reads better) stating three rules:
  1. **Confirmation narration** — any tool description for a tool with a paired `confirm_*` tool must instruct the model to summarize the proposed change to the user in plain language before calling confirm, not just chain the two calls silently.
  2. **Proactive status-checking** — any tool description for a tool that starts async background work must instruct the model to proactively poll the relevant status tool and narrate progress to the user, generalizing the pattern `ingest_text`'s description already uses for `get_source_status` into a standing rule for any future async tool.
  3. **Error tone** — add one sentence to `ONBOARDING_INSTRUCTIONS` (not repeated per tool description) instructing the model to translate a tool's `{ error: { code, message } }` result into a plain, non-alarming explanation with a suggested next step, rather than relaying raw JSON to the user.
  Also add the actual error-tone sentence to `ONBOARDING_INSTRUCTIONS` itself as part of this ticket (rule 3 both states the policy and applies it once, since it's a single shared string, not a per-tool retrofit).

Out of scope: retrofitting `tool-descriptions.ts`'s individual tool descriptions for narration/status-checking compliance — that's T-101, sequenced after this ticket so it has the written rule to audit against. Do not touch `tool-descriptions.ts` in this ticket except leaving it unmodified.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `.claude/rules/mcp.md` contains a new section stating all three rules above in prescriptive language (grep for language covering "confirm", "proactively" or "poll", and "error" in the new section)
  - `ONBOARDING_INSTRUCTIONS` in `packages/mcp/src/content/onboarding-instructions.ts` contains the error-tone sentence
  - existing `packages/mcp` test suite (including any snapshot/content test on `ONBOARDING_INSTRUCTIONS`) still passes after the instructions-text change

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_4_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
