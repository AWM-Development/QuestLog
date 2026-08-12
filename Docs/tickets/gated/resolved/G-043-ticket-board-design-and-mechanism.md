# G-043 — Ticket-board view design and repo-tie mechanism

Gate type: 🎨 design

Milestone ref: M-OBS.9

Opened: 2026-08-12 — by Alex/agent during an interactive planning session (Alex wanted a sprint-board-style view of the ticket pipeline, visually replacing manual `/lineup` reads for day-to-day tracking)

Context files (load ONLY these):
  - Docs/mockups/observability-dashboard/index.html, log.html, shared.css (existing routes/chrome this view extends)
  - Docs/mockups/observability-dashboard/NOTES.md (IA precedent — separate routes, not tabs)
  - Docs/tickets/TICKET_SPEC.md (the fields every ticket file carries — what a card needs to parse and show)
  - Docs/tickets/queue/T-055-pr-diff-stat-sync.md (the codebase's existing GitHub-API-from-server precedent this gate's mechanism follows)
  - Docs/tickets/backlog/T-057-observability-dashboard-trends-view.md (the `apps/observability-dashboard` app shell this view's route would extend)

Open question: What does a ticket-prioritization board section look like (IA, columns, card contents), and how does it stay tied to real repo state — build-time static scan, a live server-side read of the repo, or piggybacking the existing `packages/observability` DB?

Blocks: M-OBS.9 — Ticket-board view

Notes: Raised alongside a broader ask ("use /ticket-writer for a new milestone") — flagged first that `ticket-writer` extracts existing milestone scope rather than inventing it, so this gate was resolved before any ticket got drafted, same order `G-004` followed for the original dashboard.

---

## Resolution (2026-08-12)

Resolved interactively with Alex, same session as the gate was opened.

**IA — third route on the existing dashboard, not a new app.** `apps/observability-dashboard` (stood up by T-057) gets a third route, `/board`, sharing the same nav/`shared.css` chrome as `/` (Trends) and `/log` (Log) — consistent with `G-004`'s "separate routes, not tabs" precedent. No new standalone tool.

**Columns — mirror `Docs/tickets/`'s real folders 1:1.** Left to right: Gated → Backlog → Queue → In-progress → Blocked → Done. This is the literal filesystem state, not an invented taxonomy, so the board can never drift from what `/lineup` or a manual `ls` would show.

**Card contents** — per ticket file: id, one-line title, complexity tier badge, priority tag, `Blocked on:` chips and `Gated on: G-###` chips where present (reusing `TICKET_SPEC.md`'s own fields, nothing invented).

**Read-only for v1.** No drag-and-drop, no in-board editing. Alex continues driving actual state changes via `/promote`, the nightly executor, `/ungate`, etc. in Claude Code — the board reflects reality, it doesn't author it. Revisit if that friction turns out to matter in practice.

**Repo-tie mechanism — live server-side read via GitHub API, not a build-time scan or a DB table.** Rejected alternatives and why:
- *Build-time static JSON scan* — would need a rebuild/redeploy (or a CI job) to reflect a fresh `develop` push, adding a staleness window and a moving part outside the app itself.
- *Piggyback `packages/observability`'s DB* — ties board freshness to executor-run ingestion (`T-095`) rather than every doc change, and mixes run-history data with repo-state data that live on genuinely different axes (a ticket's *folder* changes on every `/promote`/merge, independent of any executor run).

Instead: a new tRPC router in `apps/server` (mirrors `source.ts`'s thin-router-delegates-to-service shape, same as every other router in this codebase) with one read procedure that fetches `Docs/tickets/**/*.md`'s tree from the GitHub API against `develop` (same "`gh`/GitHub API from the server" pattern `T-055` already establishes for PR diff-stats — reuse whatever token/auth mechanism that ticket lands on rather than provisioning a second one), parses each file's `TICKET_SPEC.md` header fields plus its containing folder (the folder *is* the status), and returns the parsed list. A short in-memory TTL cache (~60s) in the router avoids re-hitting the GitHub API on every page load while keeping a push-to-`develop` visible within about a minute — no manual refresh, no build step.

Ticketed as:
- **T-157** — Observability API: ticket-board read endpoint (backend). No `Blocked on:` — independent of `T-054`/`T-055`'s DB-backed endpoints, though it follows `T-055`'s GitHub-API-from-server pattern as precedent.
- **T-158** — Observability dashboard: Board view (frontend route). `Blocked on: T-057, T-157` — extends T-057's app shell/nav and calls T-157's endpoint.

`M-OBS.9`'s line in `Docs/milestones/MILESTONES_V1_2_MCP.md` updated from `(Gated on: G-043)` to `(T-157, T-158)`.
