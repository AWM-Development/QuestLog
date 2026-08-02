# T-096 — Fix `manually_inspected` false-positive detection

Milestone ref: M-OBS.8

Complexity tier: S

Strategy-gate flag: no

Priority: P1

Branch: feat/m-obs/t-096-fix-manually-inspected-false-positive

Context files (load ONLY these):
  - packages/core/src/observability/usage-summary.ts
  - packages/core/src/observability/usage-summary.test.ts
  - packages/core/src/observability/artifact.ts
  - packages/core/src/observability/artifact.test.ts

Mockup: none

Model: sonnet

Scope: Fix `summarizeUsage`'s human-message classification in `packages/core/src/observability/usage-summary.ts`. Today it treats any `user`-role transcript turn that isn't a plain string and doesn't contain a `tool_result` block as a genuine human-typed message (the `else` branch at the bottom of the loop, ~line 145-158). Real transcripts show this misfires on framework-injected `user` turns that arrive as array content with `type: "text"` blocks but no human authorship — confirmed two concrete shapes in this project's own `~/.claude/projects/-Users-alexandermeyer-Documents-Code-QuestLog/*.jsonl` transcripts: skill/slash-command load expansions (text beginning `Base directory for this skill:` or similar preamble the harness injects) and interrupt notices (literal text `[Request interrupted by user]` / `[Request interrupted by user for tool use]`). Because nearly every session invokes at least one slash command or skill, `humanMessageCount` climbs past 1 on nearly every run — including fully autonomous ones — making `manually_inspected` fire almost universally instead of only when Alex actually typed a follow-up message mid-run.

Update the classification so these two known injected shapes are excluded from `humanMessageCount` (pattern-match the interrupt-notice literal strings, and treat harness preamble text — recognizable by its fixed lead-in — as non-human), while a genuine plain-string human turn (the existing `humanTurn` fixture shape) still counts. Add regression tests to `usage-summary.test.ts` using fixture JSONL built from the real shapes found (a skill-load text block, an interrupt-notice text block, and the existing genuine human-string case in the same transcript) asserting `humanMessageCount`/`manuallyInspected` come out correct for each.

Out of scope: Removing `manually_inspected`/`human_message_count` from `UsageSummary` or `artifact.ts`'s schema (the field stays — this ticket fixes its detection, it does not retire it). Touching `M-OBS.3`/`T-053`'s persistence layer, or any dashboard/report consumer of this field — none exist yet on `develop`. Building a general-purpose classifier for arbitrary future injected-content shapes beyond the two confirmed here; if a new shape causes another false positive later, that's a new ticket informed by new evidence, not speculative hardening now.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `usage-summary.test.ts` includes a case asserting a transcript containing a skill-load-style text-block user turn plus one genuine human-string kickoff turn yields `humanMessageCount: 1` / `manuallyInspected: false`
  - `usage-summary.test.ts` includes a case asserting a transcript containing an interrupt-notice text-block user turn plus one genuine human-string kickoff turn yields `humanMessageCount: 1` / `manuallyInspected: false`
  - the existing "flags manually_inspected when more than one human message is present" test (genuine second human string turn) still passes unmodified in intent — a real second human message still trips `manuallyInspected: true`

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
