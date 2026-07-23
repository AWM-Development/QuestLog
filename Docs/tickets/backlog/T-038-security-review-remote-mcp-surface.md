# T-038 — Security review of the remote-MCP surface

Milestone ref: M-AUDIT.2 (`Docs/MILESTONES_V1_1_MCP.md`)

Blocked on: T-030, T-031, T-032, T-033, T-037 — must all be merged into develop first

Branch: feat/m-audit/t-038-security-review-remote-mcp-surface

Context files (load ONLY these — this ticket's whole point is a security
review, so read broadly within this list rather than narrowly):
  - packages/mcp/src/**, packages/core/src/services/mcp-oauth.service.ts  (the OAuth shim, the transport mount, every tool — the entire new attack surface this milestone adds)
  - apps/server/src/server.ts (the existing REST upload endpoint, which has had zero authentication since it was built and now sits on the same public Fly app as the new authenticated MCP surface — is that inconsistency itself a finding?)
  - .github/workflows/smoke-test-dev.yml, .github/workflows/smoke-test-prod.yml (the new `DEV_DATABASE_URL`/`PROD_DATABASE_URL` GitHub Actions secrets these introduce — real credentials in a new automated path)
  - Docs/tickets/reports/T-025-executor-dev-only-guardrails-prod-clean-start.md (the existing guarantee — "no automated path has real Neon credentials" — that T-036/T-037 knowingly created a new, deliberate exception to; confirm that exception is as narrowly scoped as intended)
  - Docs/DEPLOY_SETUP_CHECKLIST.md (current secrets inventory, for cross-reference)

Mockup: none

Model: sonnet — this is evidence-gathering + a written report + follow-up
  tickets, not a large diff; unlike T-017 this doesn't need Alex's
  institutional judgment on "is this the intended architecture," it needs
  an adversarial read of the new surface, which a capable agent can do.
  Severe findings (anything that could let an unauthenticated party read
  or write real campaign data, or exfiltrate a secret) must follow the
  Blocked Protocol rather than being remediated unilaterally — flag and
  stop, don't silently patch something this consequential without Alex
  seeing it first.

Scope:
  Produce a written security review covering, at minimum:

  1. **OAuth shim correctness** — does `/authorize` actually gate on the
     passphrase before issuing a code (not just before rendering success)?
     Is the passphrase compared with a timing-safe comparison, not `===`?
     Are authorization codes genuinely single-use and short-lived? Is PKCE
     actually enforced (a request without a valid `code_verifier` must
     fail), not merely accepted-if-present? Does `/token` validate the
     `resource` parameter against this server's own URL, preventing a
     token minted here from being replayed against a different resource?
  2. **Transport-layer auth** — can any tool be reached without a valid
     bearer token under any code path (e.g. a debug/test route left
     enabled, a missing check on one specific tool)? Does token validation
     actually check expiry, not just existence?
  3. **New write-tool input validation** — `ingest_text`, `create_entity`,
     `append_entity_note`: are their Zod schemas actually enforced end to
     end, or does anything reach the service layer unvalidated? Is there
     any injection risk in how `ingest_text`'s content flows into
     chunking/embedding or `create_entity`'s fields flow into Drizzle
     queries (parameterized queries should already prevent SQL injection
     via Drizzle, but confirm no raw SQL string interpolation was
     introduced anywhere in this milestone's new code)?
  4. **The pre-existing unauthenticated upload endpoint** — now that a
     real auth story exists for `/mcp`, is leaving
     `POST /api/campaigns/:id/sources/upload` completely open a
     newly-inconsistent gap worth closing, or an accepted v1 tradeoff
     that's fine to leave? Name it either way — don't silently skip it
     because it predates this milestone.
  5. **New CI secrets** — are `DEV_DATABASE_URL`/`PROD_DATABASE_URL`
     scoped as narrowly as the workflows actually need (e.g. could a
     compromised PR-adjacent workflow reach them — confirm the trigger is
     genuinely `push` on protected branches only, not something a fork PR
     could trigger)?
  6. **Secret handling** — `MCP_ACCESS_PASSPHRASE` and the OAuth
     client/token tables: any place a secret could leak into logs, error
     messages, or a committed file?

  For each finding: trivial fixes (a missing timing-safe comparison, a
  log line that includes a token) get fixed inline in this session's
  branch. Substantive findings (a real design gap) get filed as a new
  ticket in `Docs/tickets/backlog/`, never straight to `queue/` — Alex
  reviews and promotes each one explicitly, same as T-017's own rule.

Out of scope:
  - No review of code this milestone didn't touch (the existing tRPC
    routers, the web app, etc.) — that's T-017's job, not this one.
  - No large refactors — findings become follow-up tickets, not an
    in-session rewrite.
  - No penetration testing against the real deployed dev/prod
    environments — this is a code-level review, not a live attack
    simulation; if a finding needs live verification, describe how to
    verify it rather than actually running an attack against real
    infrastructure.

Exit condition (human-checkable — this ticket is audit-shaped, not
  execution-shaped):
  - A written report at `Docs/tickets/reports/T-038-security-review-remote-mcp-surface.md`
    covering all 6 areas above, each with concrete findings (file/line
    references) or an explicit "nothing found."
  - Every substantive finding has a corresponding ticket filed in
    `Docs/tickets/backlog/`, linked from the report.
  - Any trivial inline fixes are a small, reviewable diff, called out
    separately from the filed-tickets list.
  - Any severe finding is flagged per the Blocked Protocol, not silently
    patched.

Iteration cap: not applicable (audit-shaped, not autonomous execution in
  the usual sense — but severe findings still trigger Blocked Protocol,
  not unbounded unilateral fixing)

Definition of done includes: checkbox flip for M-AUDIT.2 in
  `Docs/MILESTONES_V1_1_MCP.md`, `IMPLEMENTATION_NOTES.md` updated with
  any confirmed-safe design decisions worth recording, no `CHANGELOG.md`
  entry required unless a trivial inline fix changed shipped behavior,
  morning-report-equivalent is the review report itself.
