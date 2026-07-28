# T-035 — Auto-deploy `questlog-dev` on merge to `develop`

**Outcome:** shipped
**Branch:** feat/m-cicd/t-035-auto-deploy-dev-on-merge
**Diff:** 2 files changed, +14/-3 lines

## What shipped

`fly.dev.toml`'s header comment no longer claims dev is manual-deploy-only — it now documents that `questlog-dev` will auto-deploy on every push to `develop` via Fly's native GitHub integration, mirroring `fly.prod.toml`'s existing pattern for `main`. A new `### 3.1 Dev auto-deploy` subsection in `Docs/DEPLOY_SETUP_CHECKLIST.md` gives Alex the exact dashboard steps, scoped to `questlog-dev`/`develop` only.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (622 passed)
```

Per-package breakdown (`pnpm test`):
```
@questlog/core:test:  Test Files  26 passed (26)
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/server:test:  Test Files  14 passed (14)
@questlog/web:test:  Test Files  46 passed (46)
 Tasks:    5 successful, 5 total
```
(`@questlog/mcp-stdio`/`@questlog/shared` have no test scripts of their own; `lint`/`typecheck` ran across all 6 packages, 6/6 successful.)

This is a docs-only ticket — no code or test changes were needed; this run confirms nothing broke.

**Environment note (unrelated to this ticket's scope):** the first run of `scripts/run-tests-quiet.sh` failed on a stale/missing `node_modules/.bin/biome` symlink in several workspaces (fixed with a fresh `pnpm install`) and then on `questlog_test` missing the `mcp_oauth_clients` table (fixed by re-running `pnpm --filter @questlog/server db:migrate` against `questlog_test` on `:5433`) — both pre-existing environment-setup gaps, not caused by this ticket's diff. Flagged under "Anything Alex must decide" below.

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above; this ticket is doc-only, confirmed as a no-op.
- **`fly.dev.toml`'s header comment no longer claims dev is manual-deploy-only** — verified: the line `"Never auto-deployed by CI/GitHub — dev stays manual-only"` is removed and replaced with a description of the new auto-deploy-via-Fly's-GitHub-integration reality (`fly.dev.toml:5-9`).
- **`Docs/DEPLOY_SETUP_CHECKLIST.md` contains the new dev-auto-deploy subsection with Alex's exact next steps** — verified: `### 3.1 Dev auto-deploy (Fly's native GitHub integration)` (`Docs/DEPLOY_SETUP_CHECKLIST.md:53-59`), mirroring §3's structure, scoped to `questlog-dev`/`develop`.

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim:

> Confirmed: the diff touches only the two files the ticket scoped in, no `.github/workflows/*`, no `fly.prod.toml` changes, and no attempt at the Alex-only Fly dashboard connection.
>
> **Header comment (fly.dev.toml:1-15):** Correctly mirrors `fly.prod.toml`'s header structure (auto-deploy-once-connected + manual fallback + build-context note), substitutes `develop`/`questlog-dev` for `main`/`questlog-prod` appropriately, and removes the stale "Never auto-deployed by CI/GitHub — dev stays manual-only" claim. Meets exit condition 2 exactly.
>
> **New checklist subsection (Docs/DEPLOY_SETUP_CHECKLIST.md:53-59):** Faithfully mirrors §3's structure and checklist-item wording, correctly scoped to `questlog-dev`/`develop` instead of `questlog-prod`/`main`, dated, and reasoned the same way. Meets exit condition 3.
>
> **Internal inconsistency left unresolved — Docs/DEPLOY_SETUP_CHECKLIST.md:37 and :49.** The new §3.1 (line 53-59) states dev now auto-deploys via Fly's GitHub integration on merge to `develop`, but two nearby, unedited lines in the very same document still assert the opposite:
> - Line 37: `"First deploy of **dev**, run manually (dev is never connected to GitHub auto-deploy — only prod is, §3 below)"`
> - Line 49: `"on **`questlog-prod` only** (never `questlog-dev` — dev stays manual-deploy-only, per this repo's branch model)"`
>
> Both are now stale/false given the newly added §3.1 immediately below line 51, and both restate exactly the "dev is manual-only" claim this ticket was created to correct in `fly.dev.toml`. The ticket's exit condition only names `fly.dev.toml`'s header comment explicitly, so this doesn't fail the machine-checkable exit condition, but it leaves the checklist doc internally contradictory — a reader hitting line 49 right before the new §3.1 subsection two lines later would be confused about whether dev is manual or auto. This is worth a follow-up touch given the ticket's whole premise is eliminating exactly this kind of stale "dev stays manual-only" claim.
>
> No scope creep found: `fly.prod.toml` untouched, no GitHub Actions workflow added/modified, no evidence of an attempted Fly dashboard connection (the new checklist item is correctly left as an unchecked `- [ ]` Alex-only to-do, matching §3's pattern).
>
> No test-theater concern applies (doc-only ticket, no tests added, and the instructions confirm lint/typecheck/test were already run and passing separately).

Per `EXECUTOR_ROUTINE.md` Step 5, PASS-WITH-NOTES ships as-is; the noted inconsistency is carried below rather than remediated in this pass.

## Anything Alex must decide

- **Follow-up (from reviewer notes):** `Docs/DEPLOY_SETUP_CHECKLIST.md:37` and `:49` still say dev is manual-deploy-only, contradicting the new §3.1 two lines below §3. Worth a one-line fix on both (e.g. "See §3.1 — dev now auto-deploys too") — small enough to fold into whichever ticket next touches this file, or a quick manual edit.
- **Milestone checkbox (M-CICD.1) deliberately not flipped**, per this ticket's own Definition-of-done: it stays unchecked until Alex connects `questlog-dev`'s Fly dashboard GitHub integration to `develop` and confirms a real merge triggers a dev deploy (checklist steps in §3.1).
- **Environment gap, not this ticket's scope:** `tmp/.session-context.json` (needed for this Step 7's usage-capture call) was missing at session start — `.claude/hooks/session-start.sh` normally stashes it, but it wasn't present when this run reached Step 7. Reconstructed it from this session's actual, independently-verified `transcript_path`/`session_id` (found via `CLAUDE_CODE_SESSION_ID` and the matching `/root/.claude/projects/.../<session_id>.jsonl` transcript file) rather than skipping usage-capture or fabricating values. Worth checking whether `session-start.sh`'s stash step is reliable for scheduler-triggered (`remote_trigger`) sessions specifically, since this one's rest of the hook (pnpm install, Postgres/pgvector setup, all 3 test-DB migrations) ran successfully.
- No 🧠 strategy gate applied to this ticket.
