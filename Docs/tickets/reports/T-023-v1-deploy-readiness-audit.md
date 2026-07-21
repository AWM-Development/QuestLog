# T-023 — v1 deploy readiness audit (MCP server + backend + DB)

**Outcome:** shipped
**Branch:** feat/m-mcp/t-023-v1-deploy-readiness-audit
**Diff:** 2 files changed (+153/-2 lines: `Docs/DEPLOY_READINESS.md` new, `Docs/IMPLEMENTATION_NOTES.md` appended) — no application code touched.

## What shipped

`Docs/DEPLOY_READINESS.md`: a concrete, evidence-based inventory of what's needed to deploy `apps/server` + `apps/mcp` + Postgres/pgvector to real dev and production environments, split into automatable-not-yet-done items and 🧠 strategy gates only Alex can resolve. The single biggest finding: `apps/mcp` is stdio-only (no HTTP/SSE transport), so it doesn't need separate hosting for v1 — only `apps/server` is a genuine network service. The optional Dockerfile/pgvector-image-pin stretch goal was investigated (real tag evidence gathered) but not applied to any file — this sandbox's network policy blocks Docker Hub's blob CDN, so neither a `docker build` nor a pinned-tag `extversion` readout could be verified, and shipping either unverified was judged the wrong call for a read-only investigation ticket.

## Test evidence

No application code changed — confirmed no-op:

```
$ pnpm lint
 Tasks:    4 successful, 4 total
Cached:    0 cached, 4 total
  Time:    2.902s

$ pnpm typecheck
 Tasks:    4 successful, 4 total
Cached:    0 cached, 4 total
  Time:    16.933s

$ pnpm test
@questlog/mcp:test:     Test Files  1 passed (1)   / Tests  22 passed (22)
@questlog/server:test:  Test Files  30 passed (30) / Tests  245 passed (245)
@questlog/web:test:     Test Files  46 passed (46) / Tests  262 passed (262)
 Tasks:    3 successful, 3 total
```

## Exit condition check

- **`Docs/DEPLOY_READINESS.md` exists with both lists populated, each item citing a real file/config path or a real external fact** — ✅. List 1 (§1) cites exact file/line evidence (`docker-compose.yml:3`, `apps/server/package.json`'s `tsc`-only build, `packages/shared/package.json`'s no-build-step `main`, the real `pgvector/pgvector` tag list pulled from Docker Hub's registry API). List 2 (§2) names concrete options with real external evidence for the hosting gate (Fly.io MPG's five pricing tiers with dollar figures, Railway's usage-based pricing and its pgvector-via-template caveat, both sourced via web search with links) rather than inventing numbers.
- **Stretch goal**: attempted (real tag research done), not applied to any file. Docker CLI/daemon are present in this sandbox, but every image pull (tried against both `node:20-slim` and `pgvector/pgvector:pg16`) fails at the blob-CDN layer with a reproducible `403 Forbidden` from `production.cloudfront.docker.com` — documented with the exact reproduction commands in `Docs/DEPLOY_READINESS.md` §3, matching the ticket's own instruction to "say so explicitly rather than claiming an untested build works" rather than shipping an unverified Dockerfile or database-image change.
- **All tests green, typecheck clean, lint clean — pasted output, not a summary** — ✅, pasted above (no-op, since no application code changed, as the ticket's own exit condition anticipated).
- **Every 🧠 gate item names concrete options investigated, not "needs more research"** — ✅. §2.1–2.6 each name specific, evidenced options (hosting: Fly.io MPG vs. Railway with real pricing/extension-support detail; secrets: platform-native store vs. dedicated secrets manager, with this repo's existing GitHub Actions secrets precedent named; dev/prod distinction; backup/DR; maintenance ownership; and a related-but-non-blocking note on whether `apps/mcp` should ever gain a network transport).

## Reviewer verdict

**PASS-WITH-NOTES**, verbatim (from the `reviewer` subagent, run against `git diff develop feat/m-mcp/t-023-v1-deploy-readiness-audit` before the fix below was applied):

> **Scope compliance.** The diff is exactly one file, `Docs/DEPLOY_READINESS.md` (149 lines added, nothing else touched — confirmed via `git diff develop feat/m-mcp/t-023-v1-deploy-readiness-audit --stat`). No Dockerfile, `docker-compose.yml`, or CI workflow edits — consistent with the ticket's read-only framing and the claimed decision not to ship the stretch goal. `CHANGELOG.md`/`IMPLEMENTATION_NOTES.md` correctly left untouched, matching the ticket's conditional Definition of Done ("only if the stretch goal shipped").
>
> **Exit condition checks:**
>
> 1. **Both lists populated with real citations** — I spot-checked essentially every factual claim in the document against the actual repo and live network, and every one checked out exactly: `docker-compose.yml:3`, `.github/workflows/ci.yml:17`, `.github/workflows/e2e-release-check.yml:37` all pin `pgvector/pgvector:pg16` exactly as claimed; `db:migrate` step line numbers exact; `apps/server/package.json`'s `build` is plain `tsc`, `packages/shared/package.json`'s `main` is `./src/index.ts` — confirmed; `apps/mcp` tool files import `@questlog/server/services/*` directly (no tRPC/HTTP) — confirmed by grep; Docker Hub blob-CDN 403 claim independently reproduced live; `pgvector/pgvector:0.8.5-pg16` tag research independently re-queried and matches exactly; T-016/T-019 `IMPLEMENTATION_NOTES.md` citations all accurate.
> 2. **Stretch goal handling** — honestly declared blocked, not silently skipped or falsely claimed. §3 documents the exact failure with reproduction commands, correctly distinguishes the reachable registry-metadata API from the blocked blob CDN, and correctly cites the proxy README's "don't route around it" policy.
> 3. **Lint/typecheck/test as no-op** — explicitly stated, satisfying the review task's specific ask.
> 4. **🧠 gates name concrete options** — §2.1–2.6 all name real, specific options, not vague TBDs.
>
> **Architectural claim sanity check (§0, stdio-only)** — verified directly against `apps/mcp/src/main.ts:1-7` and `apps/mcp/src/server.ts`: only `StdioServerTransport` is constructed, no HTTP/SSE transport exists anywhere in `apps/mcp/src/**`, and `apps/server/src/main.ts` is the only component with a real Fastify network listener. The claim is accurate and not overstated.
>
> **One real finding:** `Docs/DEPLOY_READINESS.md:117` and `:147` both attribute the phrase "irreplaceable campaign lore" to `Docs/PRD.md` §8 — that phrase does not appear anywhere in the PRD; the actual source is the ticket file's own Context framing. This is a misattributed citation in a document whose entire premise is "cite real facts, not invented ones." Given the rest of the document's citation accuracy is exceptionally high, this single misattribution is a minor defect, not evidence of systemic fabrication.
>
> PASS-WITH-NOTES

**Remediation applied:** the misattributed citation was fixed (both occurrences, §2.4 and §3) to correctly attribute the phrase to the ticket's own Context framing rather than `Docs/PRD.md` §8 — see commit `fix(T-023): correct misattributed citation in deploy readiness audit`.

## Anything Alex must decide

- All five items in `Docs/DEPLOY_READINESS.md` §2 (hosting provider, secrets management, dev/prod distinction, backup/DR policy, maintenance ownership) are unresolved 🧠 gates by design — this ticket investigates and lists options, per its own scope, but decides none of them. §2.6 additionally flags a related, non-blocking question: whether `apps/mcp` should ever gain a network transport (currently stdio-only, which is sufficient for v1's documented local-client model).
- The Dockerfile/pgvector-image-tag-pin stretch goal was not shipped — full reasoning in `Docs/DEPLOY_READINESS.md` §3. Both are specified precisely enough (§1.1, §1.4) that T-024 (currently blocked on this ticket, now unblockable) can apply them directly. If Alex has real Docker Hub network access, verifying `docker build` against a generated Dockerfile and pasting the `0.8.5-pg16` tag's `extversion` readout would let T-024 skip re-deriving that research.
- Per this ticket's own Definition of Done, `MILESTONES_V1_MCP.md`'s M-MCP.5 checkbox is deliberately **not** flipped (stays unchecked until the full deploy milestone ships), and no `CHANGELOG.md` entry was added (only required if the stretch goal shipped a real file change, which it didn't).
