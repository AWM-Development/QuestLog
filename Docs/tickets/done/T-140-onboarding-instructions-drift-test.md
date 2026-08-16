# T-140 — ONBOARDING_INSTRUCTIONS drift test

Milestone ref: Docs/milestones/MILESTONES_V1_5_MCP.md, M-POLISH.2

Complexity tier: S

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-polish/t-140-onboarding-instructions-drift-test

Context files (load ONLY these):
  - packages/mcp/src/content/onboarding-instructions.ts
  - packages/mcp/src/server.ts
  - packages/mcp/src/tools/ (the register*.ts files — for each file's
    server.registerTool("<name>", ...) string, the source of truth for
    what "registered tool name" means)

Mockup: none

Model: sonnet

Scope: `ONBOARDING_INSTRUCTIONS` (packages/mcp/src/content/onboarding-instructions.ts)
  hand-lists tools in prose. Nothing today fails if a new tool ships and
  this prose isn't updated to mention it. Add a new test file
  `packages/mcp/src/content/onboarding-instructions.test.ts` asserting
  every tool name registered inside `createMcpServer`
  (packages/mcp/src/server.ts) appears somewhere in the
  `ONBOARDING_INSTRUCTIONS` string. Derive the registered-name list from
  the actual registration call sites (e.g. call `createMcpServer` against
  a stub/mock `McpServer` and capture each `registerTool(name, ...)` call's
  `name` argument, or parse the literal tool-name string out of each
  `tools/*.ts` file) — a hardcoded literal array duplicated from
  `server.ts`/`tools/*.ts` is explicitly disallowed, since it reintroduces
  the exact drift this ticket exists to catch instead of actually deriving
  from the live registration list.

Out of scope: no changes to `ONBOARDING_INSTRUCTIONS`'s prose itself (it
  already mentions every currently-registered tool); no codegen of the
  instructions text from the tool list; no changes to the `help` tool
  (uses the same constant, already covered by this same string).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - the new test passes today against every currently-registered tool name
  - in the ticket's report, paste proof the assertion actually detects
    drift: temporarily register a fake tool name via `createMcpServer` (or
    inject one into the derived name list) that isn't mentioned in
    `ONBOARDING_INSTRUCTIONS`, show the test fails, then revert before the
    final commit

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_5_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.

## Resolution — unblocked 2026-08-11

Blocked report: `Docs/tickets/blocked/T-140-onboarding-instructions-drift-test.md`
(see branch history — the ticket file at that path was this same file,
overwritten with the blocked report per `BLOCKED_TEMPLATE.md`'s convention
of reusing the ticket's filename).

**Alex's answer to the exact question:** "Yes include the missing tools" —
`ONBOARDING_INSTRUCTIONS`'s prose is updated to mention the 6 tools the
blocked report found missing (`archive_entity`, `confirm_archive_entity`,
`unarchive_entity`, `confirm_unarchive_entity`, `correct_lore`,
`confirm_correct_lore`), resolving the contradiction between Exit condition
and Out of scope in favor of fixing the real drift rather than narrowing
the test's guarantee. The Out of scope line's "no changes to
`ONBOARDING_INSTRUCTIONS`'s prose itself" is superseded by this resolution
for exactly the 6 named tools — no other scope change.
