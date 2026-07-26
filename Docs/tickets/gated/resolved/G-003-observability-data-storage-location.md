# G-003 — Observability data storage location

Gate type: 🧠 strategy

Milestone ref: M-OBS.3, M-OBS.4

Opened: 2026-07-25 — by Alex/agent during planning (this session's pivot from ad-hoc usage auditing to a built-in observability system)

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts
  - apps/server/drizzle.config.ts
  - CLAUDE.md (v1 scope: "The only kept web surface is SourcesPage; everything else is v2" — bears on whether pipeline-observability data belongs in the same Neon project as campaign data)
  - Docs/tickets/T-046-executor-usage-capture-hook.md (the file-based artifact shape this data currently takes, once drafted)
  - Docs/tickets/REPORT_TEMPLATE.md, Docs/tickets/BLOCKED_TEMPLATE.md (the report content this store must also ingest — see expanded scope below)

Open question: Once T-046's file-based usage artifacts — and now also each ticket's morning report (shipped) or blocked report (blocked) — need to be queryable (trends over time, filtering out empty runs, joining against PR diff size, browsing "what did the executor do yesterday"), where should that data actually live — new tables added to the existing `packages/core/src/db/schema/tables.ts` / Neon branch alongside campaign data, or a fully separate store (a second Neon project/branch, or something outside Neon entirely) kept independent of the DM product's own schema and migrations?

Blocks: M-OBS.3 — Persist usage/efficiency data to a queryable store, M-OBS.4 — API endpoint(s) serving usage/efficiency data

Notes: Raised explicitly by Alex during planning ("or if we want to separate out the tables in Neon from the campaigns and stuff"), not yet decided. Two options surfaced so far, not evaluated in depth:
  - **Same schema/branch as campaigns:** simplest — reuses the existing drizzle migration pipeline, one `DATABASE_URL`, one connection pool. Couples pipeline meta-data (about running the executor) to the product schema (about the DM's campaigns), which may not matter for a single-user app but is a real coupling if this ever needs to be reasoned about independently (e.g. a portfolio reviewer asking "wait, why does a tabletop RPG app's schema have token-usage tables?").
  - **Separate store:** keeps observability fully decoupled — arguably the more defensible answer given the explicit portfolio-DX framing of this feature (it's infrastructure-about-the-pipeline, not app data) — but adds a second connection/config surface to maintain, and needs its own decision on *what* separate store (another Neon branch under the same project vs. a wholly different project/technology).
  This decision changes what M-OBS.3 and M-OBS.4 actually build (different context files, different migration location, possibly different package), not just how — hence gated rather than drafted with an assumed default.

  **Expanded scope (added after G-003 was first opened):** Alex wants a "one stop shop" — the dashboard doubles as a logging center, so the store needs to hold each ticket's morning/blocked report content (not just T-046's usage numbers and T-047's efficiency notes), keyed by ticket id, so the dashboard can show both trend data and a browsable log of "what the executor actually did." Whichever schema this resolves to should also plan for these fields, surfaced during the same planning session:
  - `reviewer_verdict` (`PASS` / `PASS-WITH-NOTES` / `FAIL`) and `remediation_pass_required` (boolean) as structured columns, not just parsed from report prose.
  - **Cache read:write ratio** (cache-read tokens ÷ cache-creation tokens, not read ÷ total) per run — the direct signal for whether T-049 (batched context reads) is actually reducing per-turn resend overhead once it ships. No new capture logic needed: T-046 already emits the raw `cache_read_input_tokens` and `cache_creation_input_tokens` fields — this ratio (and read÷total, if ever wanted too) is purely a query-time computation over data already captured.
  - A cost/tokens-per-changed-line derived value (or the raw diff stats to compute it from) — normalizes efficiency across differently-sized tickets.
  - Blocked-outcome data as a first-class case (iteration attempts, hypotheses tried, from `BLOCKED_TEMPLATE.md`) — not an afterthought just because there have been zero blocked tickets so far.
  - PR diff stats (files/lines changed) ideally ingested automatically (e.g. a `gh`/GitHub API sync keyed by ticket id) rather than requiring a manual pull each time someone wants the diff-size correlation.
  - **From T-046's amended scope:** `turns_to_green` (distinct from total `turn_count`), `reviewer_subagent` cost/tokens as a separate sub-object (for "total system cost"), and `manually_inspected`/`human_message_count` (so sessions where Alex interrupted mid-run to ask for a cost breakdown, inflating the reported numbers, can be excluded from trend data rather than silently skewing it).
  - **From T-050/T-051 (ticket format + cost model, both ungated and shippable independent of this gate):** each report's `complexity_tier` (S/M/L) and `strategy_gate_flag`, plus the computed `total_system_cost` and `cost_vs_human_equivalent` figures — these are the fields that make every other number in this store interpretable relative to ticket size, and comparable to a human-engineer baseline.

## Resolution (2026-07-26)

Decided: **separate Neon branch, same Neon project.** New workspace package `packages/observability` holds its own Drizzle schema and migrations, its own `drizzle.config.ts` reading a new `OBSERVABILITY_DATABASE_URL` env var, and its own connection pool at query time — deliberately not merged into `packages/core/src/db/schema/tables.ts`.

Rationale, from the planning conversation: Alex explicitly wants to keep the door open to eventually extracting this observability infrastructure for reuse across other projects — it's "infrastructure about the pipeline," not app data, and the portfolio-DX framing (a tabletop RPG app's schema visibly containing token-usage tables would look wrong to a reviewer) still applies. But building a fully separate Neon project (or a different technology entirely) right now would be over-engineering for a need that doesn't exist yet — a second project is a second billing/connection surface with no current second consumer. Splitting the *branch* while keeping the *project* is the middle path: real schema/migration independence today (no coupling to campaign-data migrations, a `git grep`-visible boundary between the two domains), while deferring the heavier separate-project/technology decision until there's an actual second consumer to design for.

This unblocks M-OBS.3 and M-OBS.4, drafted as:
  - **T-053** — `packages/observability` package scaffold, Drizzle schema (`ticket_runs`, `ticket_reports`) covering this gate's full expanded field list (including placeholder columns for T-050/T-051's fields and future diff-stat sync), and an ingestion function/CLI for T-046's `*.usage.json` artifacts plus report content.
  - **T-054** — read-only tRPC endpoints over T-053's store (per-ticket, trends, log/feed views), blocked on T-053.
  - **T-055** — PR diff-stat sync via `gh`, populating the diff-stat placeholder columns T-053 declares, blocked on T-053.

M-OBS.5 (the dashboard UI) remains separately blocked on `G-004`, unaffected by this resolution beyond consuming whatever shape T-054 ships.
