# G-003 — Observability data storage location

Gate type: 🧠 strategy

Milestone ref: M-OBS.3, M-OBS.4

Opened: 2026-07-25 — by Alex/agent during planning (this session's pivot from ad-hoc usage auditing to a built-in observability system)

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts
  - apps/server/drizzle.config.ts
  - CLAUDE.md (v1 scope: "The only kept web surface is SourcesPage; everything else is v2" — bears on whether pipeline-observability data belongs in the same Neon project as campaign data)
  - Docs/tickets/T-046-executor-usage-capture-hook.md (the file-based artifact shape this data currently takes, once drafted)

Open question: Once T-046's file-based usage artifacts need to be queryable (trends over time, filtering out empty runs, joining against PR diff size), where should that data actually live — new tables added to the existing `packages/core/src/db/schema/tables.ts` / Neon branch alongside campaign data, or a fully separate store (a second Neon project/branch, or something outside Neon entirely) kept independent of the DM product's own schema and migrations?

Blocks: M-OBS.3 — Persist usage/efficiency data to a queryable store, M-OBS.4 — API endpoint(s) serving usage/efficiency data

Notes: Raised explicitly by Alex during planning ("or if we want to separate out the tables in Neon from the campaigns and stuff"), not yet decided. Two options surfaced so far, not evaluated in depth:
  - **Same schema/branch as campaigns:** simplest — reuses the existing drizzle migration pipeline, one `DATABASE_URL`, one connection pool. Couples pipeline meta-data (about running the executor) to the product schema (about the DM's campaigns), which may not matter for a single-user app but is a real coupling if this ever needs to be reasoned about independently (e.g. a portfolio reviewer asking "wait, why does a tabletop RPG app's schema have token-usage tables?").
  - **Separate store:** keeps observability fully decoupled — arguably the more defensible answer given the explicit portfolio-DX framing of this feature (it's infrastructure-about-the-pipeline, not app data) — but adds a second connection/config surface to maintain, and needs its own decision on *what* separate store (another Neon branch under the same project vs. a wholly different project/technology).
  This decision changes what M-OBS.3 and M-OBS.4 actually build (different context files, different migration location, possibly different package), not just how — hence gated rather than drafted with an assumed default.
