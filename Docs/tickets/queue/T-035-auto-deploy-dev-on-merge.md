# T-035 — Auto-deploy `questlog-dev` on merge to `develop`

**Mixed autonomy.** The doc/comment updates below are normal
nightly-eligible work. Connecting Fly's dashboard GitHub integration to
`questlog-dev` is an Alex-only action (same category as prod's equivalent
step in `Docs/DEPLOY_SETUP_CHECKLIST.md` §3) — write it up as an explicit
to-do, do not attempt it.

Milestone ref: M-CICD.1 (`Docs/MILESTONES_V1_1_MCP.md`)

Priority: P1

Branch: feat/m-cicd/t-035-auto-deploy-dev-on-merge

Context files (load ONLY these):
  - fly.dev.toml (the header comment claiming dev is manual-only — needs correcting)
  - fly.prod.toml (the already-decided pattern to mirror: Fly's native GitHub integration, not a custom Actions workflow)
  - Docs/DEPLOY_SETUP_CHECKLIST.md §2–3 (prod's auto-deploy decision and its reasoning — "one fewer secret to manage, no risk of two deploy mechanisms racing")

Mockup: none

Model: sonnet

Scope:
  Dev has been manual-deploy-only since T-024 by deliberate design (per
  `fly.dev.toml`'s own header comment and the deploy checklist). Alex has
  now decided dev should auto-deploy on every merge to `develop`, the same
  way prod already auto-deploys on merge to `main` — using the same
  mechanism (Fly's native GitHub integration) for consistency with the
  existing "one deploy mechanism, no race" reasoning, rather than a
  separate custom GitHub Actions workflow.

  1. Update `fly.dev.toml`'s header comment — it currently says "Never
     auto-deployed by CI/GitHub — dev stays manual-only." Correct it to
     describe the new reality once this ships.
  2. Update `Docs/DEPLOY_SETUP_CHECKLIST.md` §2–3 to add a new subsection
     mirroring prod's, with the exact Alex-only steps: in the Fly
     dashboard, on `questlog-dev` (only), connect its GitHub integration
     to this repo's `develop` branch specifically (not `main`), confirm it
     builds via `fly.dev.toml`.
  3. Write these as an explicit numbered checklist in the ticket's report,
     same style as the existing checklist doc.

Out of scope:
  - No custom GitHub Actions deploy workflow — Fly's native integration is
    the decided mechanism, matching prod.
  - No changes to `fly.prod.toml` or prod's auto-deploy setup.
  - Do not attempt to connect the Fly dashboard integration yourself — no
    agent has access to Alex's Fly account UI.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary (this ticket is doc-only, so this should be a no-op confirming nothing broke)
  - `fly.dev.toml`'s header comment no longer claims dev is manual-deploy-only
  - `Docs/DEPLOY_SETUP_CHECKLIST.md` contains the new dev-auto-deploy subsection with Alex's exact next steps

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-CICD.1 in
  `Docs/MILESTONES_V1_1_MCP.md` is **not** applicable until Alex confirms
  the Fly dashboard connection is live and a real `develop` merge actually
  triggered a dev deploy — same pattern as prod's own unconfirmed §3 item.
  `IMPLEMENTATION_NOTES.md` updated if any non-obvious decision was made,
  a `CHANGELOG.md` entry under `[Unreleased]`, morning report written with
  the Alex-only checklist front and center.
