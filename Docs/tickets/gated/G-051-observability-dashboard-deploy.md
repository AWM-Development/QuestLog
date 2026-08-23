# G-051 — Deploy `apps/observability-dashboard`

Gate type: 🧠 strategy

Milestone ref: M-OBS.10 (`Docs/milestones/MILESTONES_V1_2_MCP.md`)

Opened: 2026-08-23 — by Alex/agent, during `/morning-review` of T-057's PR (#310)

Context files (load ONLY these):
  - `fly.dev.toml`, `fly.prod.toml` (the two Fly apps that exist today —
    `questlog-dev`/`questlog-prod`, both `apps/server` only)
  - `apps/server/Dockerfile` (confirms the only thing it builds/serves is
    `@questlog/server` — no static frontend bundle of any kind)
  - `Docs/DEPLOY_READINESS.md` §0 (the "only `apps/server` needs to be a
    genuine network service" finding this gate is now revisiting — written
    before `apps/observability-dashboard` existed)
  - `apps/observability-dashboard/package.json`,
    `apps/observability-dashboard/vite.config.ts` (what actually exists
    today — a Vite dev server, no build/deploy tooling beyond `vite build`)
  - `AGENTS.md` line 3 (the "only kept web surface is SourcesPage;
    everything else is v2" rule this new app sits outside of — it's an
    ops tool for Alex, not app-user-facing, so that rule's rationale may or
    may not extend to it)
  - `Docs/milestones/MILESTONES_V2.md` (top of file + its "Already shipped"
    section) — the deferred web-app UI scope this gate's Open question
    below asks about interaction with

Open question: Should `apps/observability-dashboard` get real hosting at
  all for v1 (vs. staying a local-only `pnpm dev` tool the way `apps/web`
  is today), and if so:
  1. **Where does it run?** A third Fly app (own `fly.toml`, own
     subdomain), a static bundle served by the existing `questlog-dev`/
     `questlog-prod` `apps/server` Fastify process (new static-file route +
     Dockerfile stage), or something outside Fly entirely (e.g., a static
     host with no server component, since this app has no write path of
     its own — it only reads `observability.*` tRPC procedures)?
  2. **What auth/exposure?** This is Alex's own internal ops view over his
     own pipeline's cost/performance data — not campaign data, not anything
     a player or third party should see. Does it need real auth (the app
     has none today — anyone with the URL sees everything), or is an
     unlisted/obscure URL an acceptable v1 answer given it's single-user?
  3. **Interaction with `MILESTONES_V2.md`'s deferred web-app UI work:**
     v2's milestones (Entities/Relationships, Session Logging's web half,
     etc.) are a *product* surface for a DM running actual campaigns, and
     v2 planning is explicitly not open yet (`MILESTONES_V2.md`'s own
     header: "not eligible for `ticket-writer` or nightly-executor
     selection until Alex explicitly opens v2 planning"). This dashboard is
     an *ops* surface for Alex about the pipeline itself, with a different
     audience and no product-feature overlap. Does deploying it now:
     - Set a *deploy-infra precedent* v2's eventual web-app work should
       reuse (a second Fly app pattern, a shared static-hosting approach,
       an auth layer both could sit behind), making this gate worth
       resolving as an infra decision rather than a one-off?
     - Or is treating it as fully separate infra (own throwaway-simple
       hosting, no shared auth/pattern investment) the right call precisely
       *because* v2 is still unopened and its own shape isn't decided yet —
       i.e., don't let an ops tool's deploy choice quietly become the
       de facto template for a product surface that hasn't been designed?
     - Either way, should this gate's resolution get a forward pointer
       recorded somewhere `MILESTONES_V2.md`'s eventual planning session
       would actually see it (a note in that file, or in
       `IMPLEMENTATION_NOTES.md`), so the precedent (or the deliberate
       choice not to set one) isn't lost by the time v2 planning opens?

Blocks: M-OBS.10 (`Docs/milestones/MILESTONES_V1_2_MCP.md`) — no ticket has
  been drafted; deploy target, auth stance, and hosting mechanism all need
  deciding before `Scope`/`Exit condition` can be written honestly. The
  milestone task carries `(Gated on: G-051)` in place of a ticket id.

Notes: Raised directly by Alex after `/morning-review` established that
  neither `apps/observability-dashboard` (T-057, PR #310) nor `apps/web`
  (the pattern it deliberately mirrors) is wired into any Fly deploy
  config today — both are `pnpm dev`-only. T-057 itself explicitly scoped
  deployment as out of its own concern (it only had to stand the app up
  and wire it to the already-deployed `observability.*` endpoints, which
  it does — `OBSERVABILITY_DATABASE_URL` was provisioned back in T-095, so
  the data those endpoints serve is real and live on `questlog-dev` right
  now, independent of whether this dashboard gets a URL). No options below
  have been explored in code; this is a cold-open gate for `/ungate` to
  work through with Alex from scratch. T-058 (Log view) and T-059
  (comments), both extending this same app shell, are unaffected by this
  gate either way — they're about the app's content, not where it's
  hosted.
