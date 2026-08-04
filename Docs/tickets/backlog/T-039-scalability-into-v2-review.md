# T-039 — Scalability-into-v2 architecture review

**⚠️ NOT ELIGIBLE FOR AUTONOMOUS NIGHTLY EXECUTION.** Run this as an
interactive planning session with Alex, on Fable/Opus, same reasoning as
`Docs/tickets/backlog/T-017-architecture-pattern-audit.md`: judging
"will this hold up under v2's actual scope" needs Alex's institutional
context (what v2 is really going to demand, what tradeoffs are
acceptable for a single-user tool vs. worth fixing now) — not something a
narrow-context nightly agent should decide unilaterally. Do not add a
mechanical `Blocked on:` field for auto-promotion, for the same reason
T-017 doesn't have one.

**Trigger condition for pulling this into an interactive session:** once
the M-REMOTE and M-CICD tickets (T-028 through T-033, T-035 through
T-037) are in `done/` — check for anything newer spawned since before
starting.

Milestone ref: M-AUDIT.3 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Complexity tier: L

Priority: P2

Context files (load broadly, same reasoning as T-017 — a narrower list
would defeat the point):
  - Docs/milestones/MILESTONES_V1_MCP.md's "Deferred to v2" table (the actual scope this review is checking readiness against)
  - Docs/PRD.md (full read — v2's intended feature set, not just the v1-relevant sections already loaded in prior tickets)
  - Docs/DEPLOY_READINESS.md (the infrastructure decisions already made and their stated tradeoffs — Neon Free tier, single-region, etc.)
  - packages/mcp/src/** (the remote-MCP architecture this review is assessing)
  - packages/core/src/services/context.service.ts, packages/core/src/services/embedding.service.ts (the two most compute/cost-sensitive paths at scale)
  - Docs/tickets/reports/*.md (decision log)

Mockup: none

Model: Fable or Opus, interactive

Scope:
  Produce a written review covering, at minimum:

  1. **Database tier** — does Neon's Free plan (already flagged in
     `Docs/DEPLOY_READINESS.md` §2.4 as something to upgrade "before real
     campaign data goes in") remain adequate once v1.1's remote-MCP usage
     pattern is live? Is there a concrete trigger condition for the
     upgrade (a data volume, a usage pattern) rather than a vague
     "someday"?
  2. **In-process MCP tool execution** — every tool call runs inside the
     same `apps/server` Fastify process serving the REST upload endpoint
     and (once auto-deploy ships) redeploys on every `develop`/`main`
     merge. Does that shared-process model hold up if v2's chat UI
     (currently deferred, not v1.1 scope) ever comes back into play, or
     does it need isolating first?
     Concretely check T-030's `/mcp` session-transport `Map`
     (`apps/server/src/routes/mcp-http.routes.ts`, `IMPLEMENTATION_NOTES.md`
     § T-030): in-memory, no TTL/eviction, entries only cleared on a
     client's explicit `DELETE /mcp`. Accepted there as a single-user
     tradeoff — re-examine it here now that the review has the actual
     usage pattern in front of it, and file a ticket (TTL-based eviction,
     or whatever the finding calls for) if it no longer holds.
  3. **Single-region, single-instance assumptions** — `fly.dev.toml`/
     `fly.prod.toml` both pin one region, `min_machines_running = 1`. Is
     that a real constraint for v2's scope, or fine indefinitely for a
     single-user tool?
  4. **The OAuth shim's single-user design** — if QuestLog ever needed a
     second real user (not a v1.1 goal, but named in v2's deferred scope
     implicitly via any future multi-tenant feature), how large a rewrite
     would that be? Not a call to build multi-user now — just an honest
     sizing of the gap, so it's a known cost rather than a surprise.
  5. **Cost trajectory** — given the resolved Fly/Neon pricing model, at
     what usage level (if any) does the current all-free/near-free setup
     stop being free, and is that trigger point documented anywhere a
     future Alex would actually see it before hitting it?

  For each finding: if it's a real concern, file it as a ticket in
  `Docs/tickets/backlog/` (or `archive/` if the answer is "acceptable
  tradeoff, not worth a ticket, just document why"). No trivial inline
  fixes expected here — this is architecture review, not a diff.

Out of scope:
  - No implementation of any scaling fix identified — this produces
    findings and candidate tickets, not code.
  - No re-litigating M-REMOTE/M-CICD's already-resolved gates (the OAuth
    shim model, the Fly-hosting decision) — review whether they scale,
    don't reopen whether they were the right initial call.

Exit condition (human-checkable):
  - A written review at `Docs/tickets/reports/T-039-scalability-into-v2-review.md`
    covering all 5 areas above with concrete reasoning, not vague
    impressions.
  - Every real concern has a corresponding ticket (or an explicit,
    documented "acceptable tradeoff, revisit if X happens").
  - Alex has reviewed and signed off before any filed ticket is promoted
    toward `queue/`.

Iteration cap: not applicable (interactive session)

Definition of done includes: checkbox flip for M-AUDIT.3 in
  `Docs/milestones/MILESTONES_V1_1_MCP.md`, `IMPLEMENTATION_NOTES.md` updated per the
  report's findings, no `CHANGELOG.md` entry required, morning-report-
  equivalent is the review report itself.
