# T-024 — Dev and production environment + database setup

**Outcome:** shipped
**Branch:** feat/m-mcp/t-024-dev-prod-environment-database-setup
**Diff:** 16 files changed, +411/-5 lines

## What shipped

Generated (not applied) the deploy configuration T-023's resolved gates called for: an esbuild-bundled build for `apps/server` so it can run under plain `node` (mirroring `apps/mcp`'s T-019 precedent), a Dockerfile, per-environment Fly.io configs (`fly.dev.toml` / `fly.prod.toml`) with an explicit migration `release_command`, a prod-only auto-deploy GitHub Actions workflow, dev/prod env var templates, and `Docs/DEPLOY_SETUP_CHECKLIST.md` — the manual sequence only Alex can run (Neon project/branches, Fly apps, secrets, first deploy). Also carried forward T-023's `pgvector` image-tag pin (`pg16` → `0.8.5-pg16`) into `docker-compose.yml`, `ci.yml`, and `e2e-release-check.yml`. No real infrastructure was created, no real secret values were committed, and no application logic changed.

## Test evidence

```
$ pnpm lint
 Tasks:    4 successful, 4 total
Cached:    4 cached, 4 total
  Time:    59ms >>> FULL TURBO

$ pnpm typecheck
 Tasks:    4 successful, 4 total
Cached:    4 cached, 4 total
  Time:    56ms >>> FULL TURBO

$ pnpm test
@questlog/mcp:test:  Test Files  1 passed (1)
       Tests  22 passed (22)
@questlog/server:test:  Test Files  30 passed (30)
       Tests  245 passed (245)
@questlog/web:test:  Test Files  46 passed (46)
       Tests  262 passed (262)
 Tasks:    3 successful, 3 total
```

(`apps/mcp`'s `questlog_test_mcp` database, required since T-026, had never been provisioned in this sandbox — a pre-existing gap unrelated to this diff. Provisioned and migrated it the same way `ci.yml` does before running the suite, to get a real baseline rather than a false pass/fail.)

Additional direct verification beyond the standard gate (the exit condition's own migration-still-works requirement, plus proving the new build artifact is real and not just present):
```
$ cd apps/server && node scripts/build.mjs
  dist/main.js        76.5kb
  dist/db/migrate.js   913b
⚡ Done in 15ms

$ DATABASE_URL=postgresql://questlog:questlog@localhost:5433/questlog_build_smoke node dist/db/migrate.js
Enabling extensions...
Running migrations...
Migrations complete.
$ psql ... -c "\dt"   # 10 tables present, confirmed against a genuinely fresh database

$ DATABASE_URL=...questlog_test PORT=3999 node dist/main.js
Server listening on http://localhost:3999   # confirmed serving under plain node, not just tsx
```

## Exit condition check

- **All tests green, typecheck clean, lint clean — pasted output, not a summary.** Done, see above.
- **Every automated artifact listed exists as a real file.** `apps/server/Dockerfile`, `apps/server/scripts/build.mjs`, `fly.dev.toml`, `fly.prod.toml`, `deploy/env.dev.example`, `deploy/env.prod.example`, `.github/workflows/deploy.yml`, `.dockerignore` — all committed. Migration-as-explicit-deploy-step: `fly.dev.toml:19` / `fly.prod.toml:19`'s `release_command`, not on server boot (`apps/server/src/main.ts` has no migrate call). Image-tag pin: `docker-compose.yml:3`, `.github/workflows/ci.yml:17`, `.github/workflows/e2e-release-check.yml:37`.
- **`Docs/DEPLOY_SETUP_CHECKLIST.md` exists, every manual step cross-references a real file path, no step invents unresolved information.** Written; every step points at a committed file or a `Docs/DEPLOY_READINESS.md` §2 resolution. Reviewer independently confirmed the cross-references are accurate.
- **`db:migrate` still applies cleanly to a fresh `questlog_test` database.** Confirmed both via the standard `tsx`-based dev/test path (unchanged by this ticket, covered by the `pnpm test` run above) and directly re-verified by the reviewer against the real `questlog_test` database using the new bundled `dist/db/migrate.js`.
- **No secret value committed.** Grepped the full diff for API-key/password/connection-string patterns — only the pre-existing placeholder conventions (`sk-ant-...`, `pa-...`, `<user>:<password>@...`) matching `.env.example`'s own style. Reviewer independently re-ran this check.

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim (abridged — full detail independently reproduced each concrete claim rather than trusting the ticket narrative):

> Verified directly (not just claimed): `pnpm --filter @questlog/server build` produces `dist/main.js` (76.5kb) and `dist/db/migrate.js` (913b). Ran the bundled `dist/db/migrate.js` against both a fresh scratch database and the real `questlog_test` database — both applied cleanly. `pnpm lint` clean across all 4 packages; `apps/server` `tsc --noEmit` clean; `pnpm --filter @questlog/server test` — 245/245 passing. `git status --porcelain` clean after the build. Secret scan turns up only placeholder patterns. `build.mjs`'s `external` list matches `package.json`'s `dependencies` exactly. No migration call at server boot. `deploy.yml` triggers only on `push: branches: [main]`. No out-of-scope files touched. `DEPLOY_SETUP_CHECKLIST.md` steps cross-reference real files and match §2's resolved gates precisely.
>
> One minor inaccuracy (not a functionality gap): `IMPLEMENTATION_NOTES.md`'s claim that the docker-build confirmation ask is "tracked as the first item under `DEPLOY_SETUP_CHECKLIST.md`'s Fly.io section" wasn't literally true at review time — the actual first item was account creation. Worth a one-line fix.
>
> No pattern deviation, no scope creep, no test theater.

Remediation: added the missing explicit checklist item (`Docs/DEPLOY_SETUP_CHECKLIST.md` §2, now the literal first bullet) so the `IMPLEMENTATION_NOTES.md` cross-reference is accurate — committed as a follow-up commit on this branch.

## Anything Alex must decide

- **`docker build` against `apps/server/Dockerfile` was never verified end-to-end.** This sandbox's Docker Hub blob-layer CDN pulls are policy-blocked — confirmed directly in this ticket (re-tried after starting `dockerd` fresh: identical `403 Forbidden` on `docker pull node:20-slim`), matching T-023's prior finding exactly, not a new constraint. What *was* verified directly: the bundled `dist/main.js`/`dist/db/migrate.js` run correctly under plain `node`, and the Dockerfile follows a standard, well-precedented pnpm-monorepo-in-Docker structure (WORKDIR held at `/repo` across every stage so pnpm's symlinked `node_modules` layout survives being copied between stages). `Docs/DEPLOY_SETUP_CHECKLIST.md`'s new first Fly.io step asks Alex to run a real `docker build` before `fly launch` — this should be the very first thing done with this ticket's output.
- **`fly.dev.toml`/`fly.prod.toml`'s `primary_region = "iad"` is a placeholder**, not a considered choice — flagged inline in both files and in the checklist for Alex to pick deliberately (or accept) at `fly launch` time.
- **Two files' `Context files:` list didn't include everything actually needed to implement this correctly** — `apps/mcp/scripts/build.mjs` (the explicit template `Docs/DEPLOY_READINESS.md` §1.1 names) and `apps/server/package.json`/`tsconfig.json`/`src/main.ts` weren't in the ticket's own `Context files:` field, only referenced indirectly through `Docs/DEPLOY_READINESS.md`'s prose. Read them anyway, since building a correct Dockerfile/build script without them wasn't realistically possible — flagging per `EXECUTOR_ROUTINE.md` Step 3's instruction to note this as a scoping gap rather than silently pulling in extra files.
- **New finding this ticket made, not previously documented:** bundling `dotenv` (a CJS package) into an ESM esbuild output throws `Dynamic require of "fs" is not supported` at run time. Fixed by keeping it `external` and moving it to `apps/server`'s real `dependencies` — full detail in `Docs/IMPLEMENTATION_NOTES.md`'s new T-024 section. Worth knowing if a future ticket bundles another CJS-only package the same way.
- M-MCP.5's checkbox in `Docs/MILESTONES_V1_MCP.md` deliberately stays unchecked — per the ticket's own Definition of Done, it only flips once Alex completes the manual checklist and prod is actually live.
