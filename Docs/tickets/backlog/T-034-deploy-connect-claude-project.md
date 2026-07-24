# T-034 — Deploy remote MCP + connect a real Claude Project + full remote test pass

**Mixed autonomy, like T-024/T-025.** The deploy and verification-script
work below is normal nightly-eligible work. The actual Custom Connector
setup happens inside Alex's own Claude.ai account and cannot be scripted
by any agent — that part is called out explicitly in Scope and must be
left as an explicit to-do for Alex in the report, not fabricated or
skipped silently, per `Docs/tickets/BLOCKED_TEMPLATE.md`'s standard for
genuinely-absent-precondition items (see T-025's report for the precedent
— "verify prod starts clean" was honestly reported as blocked on an
infrastructure precondition, not invented).

Milestone ref: M-REMOTE.7 (`Docs/MILESTONES_V1_1_MCP.md`)

Blocked on: T-030, T-031, T-032, T-033 — must all be merged into develop first

Branch: feat/m-remote/t-034-deploy-connect-claude-project

Context files (load ONLY these):
  - Docs/DEPLOY_SETUP_CHECKLIST.md (the existing deploy checklist pattern to extend, not replace)
  - Docs/MILESTONES_V1_1_MCP.md (this ticket's own milestone task)
  - packages/mcp/src/server.ts, packages/mcp/src/tools/*.ts (the full tool set being verified)
  - The v1 test plan table from the conversation that produced `Docs/MILESTONES_V1_1_MCP.md` (if not otherwise captured in a repo file by the time this runs, ask Alex for it rather than inventing a new one from scratch)
  - fly.dev.toml, fly.prod.toml

Mockup: none

Model: sonnet

Scope:
  **Automatable (do this part):**
  1. Deploy the merged M-REMOTE work to `questlog-dev` (`flyctl deploy -c
     fly.dev.toml` from a `develop` checkout, or via M-CICD.1's auto-deploy
     if that's landed by the time this runs).
  2. Write a small verification script (`apps/server/scripts/verify-mcp-remote.ts`
     or similar) that exercises the full remote flow end-to-end against a
     given base URL: discover → register → authorize (using
     `MCP_ACCESS_PASSPHRASE` from the environment) → token → connect →
     `tools/list` → call each of the 7+ tools with minimal valid input
     against a throwaway test campaign it creates and cleans up itself.
     This is the automatable analog of the manual verification done
     during v1 sign-off (create test campaign → verify → clean up), now
     scripted and reusable by M-CICD.2 if useful there too.
  3. Run the script against `questlog-dev`, paste its output.
  4. **Write, but do not perform, the exact steps Alex needs to connect a
     real Claude.ai Custom Connector** — Settings → Connectors → Add
     custom connector → the dev server's `/mcp` URL → whatever OAuth
     fields the flow asks for. Put this in the ticket's report as a
     numbered checklist, same style as `Docs/DEPLOY_SETUP_CHECKLIST.md`.

  **Alex-only (report as an explicit to-do, do not attempt):**
  - Actually adding the connector in Claude.ai's UI and completing the
    passphrase-gated authorize step.
  - Creating a real Claude Project, connecting QuestLog to it, and running
    through the test plan's cases interactively in a real chat.
  - Repeating both of the above for `questlog-prod` once dev is confirmed
    working.

Out of scope:
  - No new application code — this ticket verifies and documents, it
    doesn't build tools or infrastructure (that's T-028–033 and M-CICD).
  - No changes to the OAuth shim or transport beyond what's needed to fix
    a genuine bug the verification script surfaces (if it finds one,
    treat that the same way the `release_command` path bug was handled
    during v1 — fix it, document why, don't work around it).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - the verification script's full output against `questlog-dev`, showing
    every tool call succeeding
  - the numbered Claude.ai connector setup checklist exists in the
    report, ready for Alex to execute
  - explicit statement in the report of what remains Alex-only and why —
    this ticket's own Definition of Done cannot be fully checked off
    without Alex completing those steps, and the report must say so
    rather than imply completion

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-REMOTE.7 in
  `Docs/MILESTONES_V1_1_MCP.md` is **not** applicable until Alex confirms
  the real Claude.ai connection works end-to-end — same pattern as
  M-MCP.5's own checkbox not flipping until Alex confirmed prod was live.
  `IMPLEMENTATION_NOTES.md` updated if any non-obvious decision was made,
  a `CHANGELOG.md` entry under `[Unreleased]` for the verification script,
  morning report written with the Alex-only checklist front and center.
