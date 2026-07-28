# T-063 — Wire `verify-mcp-remote.ts` into the M-CICD post-merge smoke-test workflows

Milestone ref: M-CICD.2/M-CICD.3 (`Docs/milestones/MILESTONES_V1_1_MCP.md`) —
  follow-up to T-034, not itself a numbered M-CICD task (same framing as
  T-042's relationship to the milestone it unblocked). Extends T-036's and
  T-037's own post-merge smoke-test workflows to also run T-034's OAuth +
  full-tool-flow verification automatically, instead of leaving
  `apps/server/scripts/verify-mcp-remote.ts` as a script a human has to
  remember to invoke by hand after every deploy.

Blocked on: T-036, T-037 — must be merged into `develop` first (this ticket
  wires into the workflow files those tickets create;
  `.github/workflows/smoke-test-dev.yml` and its prod equivalent don't exist
  yet).

Priority: P2

Branch: feat/m-cicd/t-063-wire-verify-mcp-remote-into-cicd

Context files (load ONLY these):
  - apps/server/scripts/verify-mcp-remote.ts (the script being wired in —
    note its `EXPECTED_TOOLS` roster was already removed on T-034's own
    branch and replaced with automatic call-tracking that warns, rather
    than fails, on any live tool the script doesn't yet call; do not
    reintroduce a hardcoded tool list here)
  - .github/workflows/smoke-test-dev.yml (created by T-036 — the dev
    workflow this ticket adds a step to)
  - .github/workflows/smoke-test-prod.yml or equivalent (created by T-037 —
    the prod workflow; confirm its actual filename once T-037 has merged)
  - Docs/tickets/done/T-034-deploy-connect-claude-project.md and its report
    (`Docs/tickets/reports/T-034-deploy-connect-claude-project.md`) — the
    bugs this script exists to catch, and the `MCP_ACCESS_PASSPHRASE`/
    `DATABASE_URL` inputs it needs
  - Docs/tickets/queue/T-036-post-merge-smoke-test-dev.md (dev workflow's
    own scope — note line 37-38 already anticipates sharing code with this
    script)
  - Docs/tickets/backlog/T-037-post-merge-smoke-test-prod.md (prod
    workflow's **read-only-by-default** framing — read this carefully
    before scoping what runs against prod, see Scope below)
  - Docs/IMPLEMENTATION_NOTES.md § T-034 (the three deploy bugs this script
    surfaced — the rationale for why this needs to run on every deploy,
    not just once)

Mockup: none

Model: sonnet

Scope:
  1. **Dev workflow (`smoke-test-dev.yml`, from T-036):** add a step that
     runs `verify-mcp-remote.ts`'s full sequence (discover → register →
     authorize → token → connect → tools/list → call every known tool)
     against the freshly-deployed `questlog-dev` URL, using the
     `MCP_ACCESS_PASSPHRASE` and `DATABASE_URL` GitHub Actions secrets
     (`DATABASE_URL` likely already exists from T-036 as `DEV_DATABASE_URL`
     — reuse it, don't add a second secret for the same value). Fail the
     workflow (non-zero exit) if the script fails, same as every other step
     in that workflow.
  2. **Prod workflow (from T-037): reconcile the read/write mismatch
     explicitly, don't silently resolve it.** `verify-mcp-remote.ts`
     creates and deletes a throwaway campaign — it is a write, and T-037's
     own ticket deliberately scoped prod's smoke test to **read-only by
     default**, calling an automated write against prod on every merge "a
     bigger call than to default into silently." Two legitimate paths,
     pick one and document the choice (don't just pick silently):
     - **(a) Read-only subset:** run only `verify-mcp-remote.ts`'s
       non-mutating steps (discover/register/authorize/token/connect,
       `tools/list`, then only read tools — `list_campaigns`, `query_lore`,
       `prep_brief`, `get_entity`/`list_entities` — against a pre-existing,
       permanently-seeded fixture campaign in prod rather than a
       throwaway one). This may need a small script variant or a flag on
       the existing script; don't fork the whole file if a
       `--read-only`/env-gated mode covers it cleanly.
     - **(b) Full write sequence:** if Alex decides prod's smoke test
       should match dev's full round-trip (T-037's own ticket text flags
       this as a possible future revision), that's an explicit escalation
       beyond T-037's stated default — flag it to Alex as a decision point
       in the report rather than assuming it, the same way T-037 itself
       flagged the choice rather than deciding it.
     Do not default to (b) without Alex's confirmation captured in the
     report; if unresolved by the time this ticket's iteration cap is hit,
     ship (a) and note (b) as a follow-up decision for Alex.
  3. Confirm the coverage-warning behavior already in `verify-mcp-remote.ts`
     (the `calledTools` vs. live `tools/list` comparison) surfaces visibly
     in the workflow's log output — it should already work unchanged, this
     is a verification step, not new code.

Out of scope:
  - Re-fixing the hardcoded-tool-list brittleness — already done on T-034's
    branch (`calledTools` auto-tracking). If a new MCP tool ships without a
    corresponding `call(...)` line in `verify-mcp-remote.ts`, that's a gap
    in *that* tool's own ticket to close, not something to re-architect
    here.
  - Expanding what prod's smoke test writes beyond whatever Scope #2 above
    resolves to — no "while I'm here, let's also let it write X."
  - Any change to the OAuth shim, HTTP transport, or `verify-mcp-remote.ts`'s
    own OAuth/PKCE logic — this ticket is CI wiring only.
  - Building `smoke-test-dev.yml`/its prod equivalent from scratch — that's
    T-036/T-037's job; this ticket only adds a step to what they create.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary
  - the dev smoke-test workflow's YAML includes the new step and is valid
    (GitHub Actions lints on push; run a local YAML linter first if
    available)
  - locally: run `verify-mcp-remote.ts` (or its read-only-subset variant,
    if Scope #2(a) is picked) against a real or realistic target, paste
    the output
  - demonstrate the workflow step correctly fails (non-zero exit) on a
    broken assertion, same method T-036 used — don't trigger a real
    workflow run without secrets in place
  - the report explicitly states which of Scope #2(a)/(b) was chosen for
    prod, and why

Iteration cap: 3 distinct approaches on any single failure, then Blocked
  Protocol

Definition of done includes: `Docs/IMPLEMENTATION_NOTES.md` updated with
  which prod read/write path was chosen and why, a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written with prod's read/write
  decision front and center for Alex to confirm (or override) if Scope
  #2(a) was shipped as the safe default. No milestone checkbox to flip —
  M-CICD.2/M-CICD.3's own checkboxes are T-036/T-037's to flip, not this
  ticket's.
