# T-046 — Executor usage-capture hook

Milestone ref: M-OBS.1

Branch: feat/m-obs/t-046-executor-usage-capture-hook

Context files (load ONLY these):
  - .claude/settings.json
  - .claude/hooks/session-start.sh
  - Docs/tickets/EXECUTOR_ROUTINE.md
  - Docs/tickets/REPORT_TEMPLATE.md
  - packages/core/src/db/schema/tables.ts (read-only, for the "no DB yet" boundary — do not add tables)

Mockup: none

Model: sonnet

Scope: Anthropic exposes no API for per-session token usage on this account — the executor's own transcript is the only ground truth available (each turn's API response `usage` — input/output/cache_creation/cache_read tokens — is what Claude Code already logs to the session's JSONL transcript). Add a Claude Code `Stop` hook, wired in `.claude/settings.json` (same shape as the existing `SessionStart` entry), that fires at the end of every session running in this repo:
  - Read the hook's stdin JSON payload for `transcript_path` (and `session_id`).
  - Parse pure logic into testable functions in a new `packages/core/src/observability/` module:
    - `usage-summary.ts`: given the transcript's JSONL content, sum `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` across every assistant message with a `usage` field; compute wall-clock duration from the first and last message timestamps; count assistant turns.
    - `pricing.ts`: current Sonnet 5 metered rates as of this ticket (input $3/output $15 per MTok standard, $2/$10 intro through 2026-08-31; cache write 1.25x input for 5m TTL, 2x for 1h; cache read 0.1x input) as named constants with a comment noting the source and the intro-pricing expiry date — this is a **theoretical** cost estimate for a Pro-plan account, not a real charge.
    - A function computing theoretical cost from a usage summary + a pricing table (support both intro and standard rates so the artifact records both, since which one applies depends on the run's date relative to 2026-08-31).
  - Determine which ticket this run processed by checking recent commit subjects (`git log -1 --format=%s` and a short walk back) for a `T-###` pattern, falling back to whichever file under `Docs/tickets/done/` or `Docs/tickets/blocked/` has the newest mtime. If no ticket id is found (e.g. the `NO_TICKET_QUEUED`/`NO_ACTIONABLE_TICKET` early-exit paths in `EXECUTOR_ROUTINE.md` Step 1), tag the record `"ticket_id": null, "empty_run": true` instead of failing.
  - Write the result as `Docs/tickets/reports/T-###.usage.json` (or `Docs/tickets/reports/empty-run-<session_id>.usage.json` for the no-ticket case) — a small, versioned, human-readable artifact. No database writes; that's a separate, gated milestone task (M-OBS.3).
  - The hook script itself should be a thin wrapper (read stdin, resolve the ticket id, call the `packages/core` functions, write the file) — all actual logic testable via Vitest, per this repo's usual thin-shell/tested-service split.

Out of scope:
  - No persistence beyond the JSON file (no Neon tables, no API endpoint — gated on G-003, not this ticket).
  - No backfill of historical runs — this only captures data going forward from when it ships.
  - No changes to `EXECUTOR_ROUTINE.md`'s Steps 1–6 decision logic. Step 7 may need one line noting the hook's existence, but the report format itself is T-047's scope, not this one.
  - Do not attempt to distinguish "the nightly executor's session" from any other Claude Code session in this repo at the hook-config level — that's not knowable from a `Stop` hook payload alone. Instead, tag every run's artifact with the ticket id (or `empty_run: true`) it resolves to, and leave filtering "which runs actually count" to whatever reads this data later (the explicit point of the `empty_run` tag).
  - No dashboard, no UI.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `usage-summary.ts` unit-tested against a fixture JSONL transcript with known, hand-computed token totals and duration — the function's output matches exactly.
  - `pricing.ts`'s cost function, given a fixed usage summary and a fixed date, returns the correct intro-vs-standard rate and the arithmetically correct dollar figure for both.
  - A simulated hook invocation (fake stdin payload pointing at a fixture transcript file, no real Claude Code session required) produces a `*.usage.json` file with the expected shape: `ticket_id` (or `empty_run: true`), token fields, `theoretical_cost_usd`, `duration_ms`, `turn_count`.
  - A second simulated invocation with a fixture transcript that has no resolvable ticket id produces the `empty_run: true` artifact instead of erroring.

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
