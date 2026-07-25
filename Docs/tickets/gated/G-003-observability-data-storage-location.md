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
  - `cache_read_ratio` (cache-read tokens ÷ total tokens) per run — the direct signal for whether T-049 (batched context reads) is actually reducing per-turn resend overhead once it ships.
  - A cost/tokens-per-changed-line derived value (or the raw diff stats to compute it from) — normalizes efficiency across differently-sized tickets.
  - Blocked-outcome data as a first-class case (iteration attempts, hypotheses tried, from `BLOCKED_TEMPLATE.md`) — not an afterthought just because there have been zero blocked tickets so far.
  - PR diff stats (files/lines changed) ideally ingested automatically (e.g. a `gh`/GitHub API sync keyed by ticket id) rather than requiring a manual pull each time someone wants the diff-size correlation.
