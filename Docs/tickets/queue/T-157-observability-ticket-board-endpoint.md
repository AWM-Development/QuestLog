# T-157 — Observability API: ticket-board read endpoint

Milestone ref: M-OBS.9

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-obs/t-157-observability-ticket-board-endpoint

Context files (load ONLY these):
  - Docs/tickets/gated/resolved/G-043-ticket-board-visual-design.md (the resolved design/mechanism decision this ticket implements; fixed a stale filename reference here during G-043's resolution — was pointing at a slug that never existed on disk)
  - Docs/tickets/TICKET_SPEC.md (the exact fields every ticket file carries — what this endpoint must parse out of each file)
  - Docs/tickets/queue/T-055-pr-diff-stat-sync.md (this codebase's existing GitHub-API-from-server-side pattern — reuse whatever token/auth mechanism that ticket establishes rather than provisioning a second one)
  - apps/server/src/routers/source.ts (reference router for this codebase's thin-router-delegates-to-service tRPC convention)
  - apps/server/src/routers/_app.ts (where routers are registered)
  - apps/server/src/trpc.ts (procedure/context conventions)
  - packages/shared/src/validators/index.ts (where new Zod validators for this router's output shape belong)

Mockup: none

Runner: claude-code

Model: sonnet

Scope: A read-only tRPC router (`board.ts`) in `apps/server`, following this codebase's existing router conventions (thin router, Zod-validated output, delegating to a service function — same shape as `source.ts`):
  - A service function that, given no input, fetches the `Docs/tickets/` tree from the GitHub API against the `develop` branch (via whatever `gh`/token mechanism T-055 establishes — if T-055 hasn't merged yet, use the same GitHub REST API approach directly: `GET /repos/{owner}/{repo}/git/trees/develop?recursive=1` filtered to `Docs/tickets/**/*.md`, then fetch each matched file's content).
  - A pure parsing function that, given one ticket file's raw content and its repo path, extracts: ticket id, title (from the `# T-### — <title>` header), `Priority`, `Complexity tier` (if present), `Blocked on:` (if present), `Gated on:` (if present), `Branch`, a short scope excerpt (the `Scope:` field's first sentence, or its full text truncated to a fixed character budget — this ticket's call, matching what G-043's resolved mockup at `Docs/mockups/board/` needs for its card scope preview and ticket-details modal), and status — derived from which top-level folder under `Docs/tickets/` the file lives in (`gated` maps to a "Gated" status only for files directly under `Docs/tickets/gated/`, not `gated/resolved/`; `backlog`/`queue`/`in-progress`/`done`/`blocked` map 1:1 to their own status). Files under `Docs/tickets/gated/` that are gate-stubs (not tickets — no `T-###` header) are skipped, not returned as malformed cards.
  - A single query procedure (`board.list`) returning the parsed array, registered in `apps/server/src/routers/_app.ts`.
  - An in-memory TTL cache (~60 seconds) inside the service module wrapping the GitHub fetch + parse, so repeated calls within the window don't re-hit the GitHub API; a call after the TTL expires re-fetches.
  - New Zod validator for the output shape in `packages/shared/src/validators/`.
  - Not surfaced in any UI yet — T-158 is the consumer, blocked on this ticket merging first.

Out of scope:
  - No UI (T-158).
  - No write/mutation capability — this is read-only, matching the board's read-only-for-v1 decision in `G-043`.
  - No polling/websocket push — the frontend re-queries on its own schedule; this ticket only builds the cached read endpoint.
  - No retry/backoff hardening beyond a straightforward GitHub API error surfaced as a tRPC error — no circuit breaker or advanced resilience.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - the parsing function correctly derives status/priority/tier/blocked-on/gated-on/branch/scope-excerpt from a set of fixture ticket files covering each pipeline folder (backlog/queue/in-progress/done/blocked/gated), including at least one file with both `Blocked on:` and `Gated on:` present and one with neither
  - a fixture gate-stub file (no `T-###` header) under `Docs/tickets/gated/` is confirmed skipped, not returned as a malformed card
  - a second call within the cache TTL is confirmed not to re-hit the (mocked) GitHub API; a call after TTL expiry is confirmed to re-fetch

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
