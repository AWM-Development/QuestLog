# Changelog

All notable changes to QuestLog are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioned starting at `1.1.0` (the `develop` → `main` promotion that first applied this file's own cut-on-promote convention; everything shipped before that point is folded into that same first cut rather than reconstructed retroactively). `packages/*`/`apps/*` stay pinned at a placeholder `0.0.0` — they're private, unpublished workspace members; only the root `package.json` version tracks real releases.

**Obligation:** Every ticket PR merged into `develop` must add an entry here — this is part of the nightly executor's definition of done (`Docs/tickets/TICKET_SPEC.md`, `Docs/tickets/EXECUTOR_ROUTINE.md` Step 7). `[Unreleased]` accumulates entries across `develop` until Alex promotes `develop` → `main` for a release, at which point it's cut into a dated version section.

---

## [Unreleased]

### Added — T-055

- **PR diff-stat sync into the observability store.** `packages/observability/src/diff-stat-sync.ts` looks up a ticket's merged PR — via `Docs/tickets/.merge-ledger.json` (T-116) first, falling back to a `gh pr list` search by implementation-branch naming convention (`feat/<milestone-group>/t-###-<slug>`) for tickets the ledger doesn't cover — and writes files-changed/lines-added/lines-removed into that ticket's `ticket_runs` row, so diff-size correlation no longer needs a manual `gh pr list` pull per ticket. Runnable via `pnpm --filter @questlog/observability sync-diff-stats <T-###|all>`; the "all" mode syncs every row still missing diff stats. Not yet wired into `EXECUTOR_ROUTINE.md` or any scheduled job — that's a deliberate follow-up decision (M-OBS.4, T-054 still outstanding).

### Added — T-149

- **`/morning-review`: milestone context + unblocked-ticket surfacing.** The report now includes a new "Milestone context" section — the milestone task the reviewed ticket closes (with a one-sentence stub), that milestone's remaining tasks resolved against their real ticket status (not just the `[ ]` checkbox), and any `backlog/` ticket newly unblocked by this merge. Non-ticket-shaped PRs get an explicit N/A fallback. The report is now five sections instead of four.

### Added — T-054

- **Observability API read endpoints.** New read-only tRPC router (`observability.getByTicketId`, `observability.trends`, `observability.feed`) exposing T-053's observability store: per-ticket run + report detail, an aggregate trends view (date-range and `empty_run` filtering), and a paginated newest-first report feed. Uses its own DB connection, separate from the campaign-data client (G-003). Not yet consumed by any UI (M-OBS.5).

### Added — T-140

- **`ONBOARDING_INSTRUCTIONS` drift test.** A new test derives the live list of registered MCP tool names straight from each `packages/mcp/src/tools/*.ts` file's own `registerTool()` call and asserts every one is mentioned in `ONBOARDING_INSTRUCTIONS` — so a future tool that ships without an onboarding-prose update now fails a test instead of silently going undocumented. Fixing this test also surfaced and closed 7 real, pre-existing gaps: `archive_entity`, `confirm_archive_entity`, `unarchive_entity`, `confirm_unarchive_entity`, `correct_lore`, `confirm_correct_lore`, and `confirm_ingest_entities` are now all mentioned in the onboarding prose surfaced at MCP connect time (and by the `help` tool).

### Added — T-141

- **`apps/mcp-stdio` startup diagnostics.** The stdio binary's entrypoint now catches failures from each of its three startup steps (storage init, database init, MCP transport connect) and logs a diagnosable one-line `console.error` naming which step failed and why, instead of letting a bad `DATABASE_URL`, an unwritable `UPLOAD_PATH`, or a connect failure surface as a raw unhandled stack trace with no log line at all. On success, logs `QuestLog MCP server ready (stdio)`. New coverage in `apps/mcp-stdio/src/main.test.ts`.

### Changed — T-139

- **Tool-description naming & format consistency pass.** Every MCP tool description now places its "Direct write — ..." label (for tools that only ever insert a new row) immediately after the description's first sentence, and every non-preview-only tool description ends with a "Returns ..." clause naming its returned shape — locked in by new tests covering the full exported set in `tool-descriptions.test.ts`, so a future tool addition that drifts from either convention fails a test instead of silently landing. No behavior change; description text only.

### Added — T-128

- **CI job-count / GitHub Actions minutes audit.** New report (`Docs/tickets/reports/T-128-ci-actions-minutes-audit.md`) quantifying real per-job Actions-minute consumption across all five workflow files, pulled from live `gh api` run/job data. Highest-leverage finding: `ci.yml`'s `gate-guard`/`scope-guard`/`report-guard` jobs were each under 15 seconds of real work but billed a minimum of 1 minute each.

### Changed — T-128

- **`ci.yml`'s Gate/Scope/Report guards consolidated into one `ticket-guards` job.** Implemented on the audit's own branch at Alex's direct request, immediately after the report above shipped (outside the ticket's original recommendations-only Scope, flagged once before proceeding). Mirrors `T-121`'s existing `guards`-job pattern for `doc-sync`/`migration-guard`/`mockup-guard`/`impl-notes-health`; saves an estimated ~2 billed minutes per PR run at no loss of check coverage.

### Added — T-131

- **Fresh ticket worktrees now inherit the primary checkout's local secrets.** `session-start.sh`'s local worktree-provisioning branch copies the primary checkout's gitignored `.env` into a new worktree whenever that worktree doesn't already have its own — `git worktree add` never carries gitignored files across, so any locally-scoped secret (e.g. `OBSERVABILITY_DATABASE_URL`) previously never reached a ticket's worktree at all. Non-clobbering: a worktree that already has its own `.env` is always left untouched.

### Fixed — T-156

- **`ensure_database_provisioned`'s migrate child process no longer inherits an ambient `OBSERVABILITY_DATABASE_URL`.** Since T-131 propagated the primary checkout's `.env` into fresh worktrees, `scripts/db-readiness.sh`'s `ensure_database_provisioned()` silently lost every local `questlog_test_observability` migration to a real remote-Neon `OBSERVABILITY_DATABASE_URL`, whenever one was set in the primary checkout's `.env` — `packages/observability/src/db/migrate.ts`'s own connection-string resolution puts that var first, and nothing upstream prevented it from reaching the child process. Fixed by pre-setting `OBSERVABILITY_DATABASE_URL` (not just `DATABASE_URL`) to the intended local URL for that one call, in a subshell that never touches the calling process's own environment — see `Docs/IMPLEMENTATION_NOTES.md` § T-156 for why the ticket's own originally-proposed `unset`-based fix didn't actually work.

### Fixed — T-155

- **`ingest_text` 404ing on prod — stale Claude model id.** `LLM_CONFIG.model` was pinned to `claude-sonnet-4-20250514`, a decommissioned model id, causing every `ingest_text` call to fail immediately with a `404 not_found_error` (entity-candidate extraction is the LLM call on that path). Updated to `claude-sonnet-5`. Fixes every caller of the shared LLM service (chat, entity extraction), not just `ingest_text`.

### Changed — T-124

- **Three small CI cleanups from T-117's audit.** `ci.yml`'s `pr` job now runs the "no `test.only`/`test.skip`" guard immediately after checkout, before install/Lint/Typecheck/Build, so a stray `.only`/`.skip` fails in seconds instead of after paying for the full setup and three quality gates first. `e2e-release-check.yml`'s documented no-op "Restore Turborepo cache" step is removed. `ci.yml`'s `actionlint` job no longer fetches its install script from `actionlint`'s `main` branch via `curl | bash`; it now pins both the script's own ref and the binary version to a specific release tag (`v1.7.12`).

## [1.1.3] - 2026-08-10

### Changed — T-034

- **v1.1 closed out; M-REMOTE.7 checkbox flipped.** `verify-mcp-remote.ts`'s full OAuth + tool-call flow already passed end-to-end against `questlog-dev`. Alex closed the milestone checkbox explicitly ahead of his own manual Custom Connector walkthrough (planned for right after this release) rather than holding it open for that confirmation — two real prod-only blockers surfaced along the way and are recorded on the milestone task itself (`MCP_ACCESS_PASSPHRASE` unset on `questlog-prod`; `questlog-prod` still at 2 machines against the single-machine session-store constraint). Any findings from that walkthrough become a new milestone, not a reopening of this one. `Docs/milestones/MILESTONES_V1_1_MCP.md` and `AGENTS.md`'s task-source line both now mark v1.1 shipped.

### Changed — T-036, T-037

- **`DEV_DATABASE_URL`/`PROD_DATABASE_URL` GitHub Actions secrets added; M-CICD.2/M-CICD.3 closed.** Alex added both secrets. `gh run list` confirms real successful runs of `smoke-test-dev.yml` against `develop` and `smoke-test-prod.yml` against `main` — both milestone checkboxes flipped.

### Changed — T-035

- **`questlog-dev`'s Fly GitHub-integration connection confirmed; M-CICD.1 closed.** `Docs/DEPLOY_SETUP_CHECKLIST.md` §3.1's dashboard-connection step is checked off (Alex connected it 2026-08-10), and M-CICD.1's milestone checkbox is flipped on Alex's explicit confirmation. Noted in the milestone doc: `fly releases -a questlog-dev` hadn't yet shown a release for a post-connection `develop` merge at the time of flipping — worth a quick look next time a `develop` merge lands, just to see the new release show up.

### Changed — docs

- **`IMPLEMENTATION_NOTES.md` archive pass; CI size gate raised 300 → 800.** T-122 turned the `impl-notes-health` size check into a real, unconditional `exit 1` gate with no override flag, but the file was already 964 lines (3.2x the 300-line limit) at the time — blocking every subsequent PR into `develop`/`main`, including this one. Ran `/archive-implementation-notes`: 19 sections (198 lines) covering shipped v1 (`M-MCP.3`, `T-019`, `T-024`, `T-025`) and v1.1 product-feature work (`T-029`–`T-092`, the `M-REMOTE`/`M-CICD`/`M-AUDIT` tickets) moved verbatim to `Docs/IMPLEMENTATION_NOTES_ARCHIVE.md`. Two sections (`T-027`, `T-042`) were left as Uncertain per the skill's own rule — old but still actively cross-referenced by name elsewhere in the file — not archived without an explicit call. Post-archive: 766 lines, still over an initial 750 cap; raised to 800 (Alex's call) rather than force-archiving the Uncertain entries or dropping the gate.

### Changed — T-122

- **`ci.yml`'s `doc-sync` and `impl-notes-health` guard checks are now real failing gates.** All three previously warning-only violation paths — `doc-sync`'s missing-`Docs/`-update check, `impl-notes-health`'s `IMPLEMENTATION_NOTES.md` size check, and its sensitive-file write-obligation check — now `exit 1` on a real violation instead of always `exit 0`. The existing `[skip-doc-check]`/`[skip-impl-notes]` PR-title escape hatches are unchanged and still exit 0. Matches `migration-guard`/`mockup-guard`'s existing hard-fail behavior in the same job. Implements `T-117` audit finding #3, per Alex's decision during the `/morning-review` follow-up on T-117 (2026-08-03).

### Changed — T-138

- **`scripts/worktree-postgres-env.sh` and `.claude/hooks/session-start.sh` now default `CLAUDE_PROJECT_DIR` instead of hard-requiring it.** A no-op under Claude Code (which always exports the variable); a runner that doesn't export it now falls back to `git rev-parse --show-toplevel`, deriving the same worktree-scoped value instead of hard-failing or — worse — silently colliding two concurrent agents onto the same Postgres port and compose project. See `IMPLEMENTATION_NOTES.md` § T-138.

### Added — T-115

- **The nightly executor's own pre-flight now runs the same enforcement scripts CI does, before committing effort to a ticket.** Right after `EXECUTOR_ROUTINE.md` Step 2's pickup commit (the first point a real `origin/develop...HEAD` diff exists for a freshly-picked or resumed candidate), the routine now invokes every `scripts/ci-*-guard.sh` script found on disk, except `ci-red-check-guard.sh` — discovered dynamically by glob rather than named individually, so a future guard added or removed (`T-113`'s own `ci-exit-condition-guard.sh` was retired mid-lifecycle, during this same ticket's development — see `IMPLEMENTATION_NOTES.md` § T-115) never needs a doc update to stay accurate. A candidate that fails gate-guard (an unresolved `Gated on:`/unmet `Blocked on:` slipping past Step 1's own hand check — a sync bug) is abandoned before its worktree is even pushed, same skip-and-note treatment as an already-blocked candidate. Every other discovered guard is wired in for the same reason but only bites meaningfully on a case-4 resume, whose branch may already carry an interrupted prior session's work; a fresh pick's diff is too small for most of them to have anything to check. `T-114`'s red-check is the one permanent, named exclusion — it needs a completed implementation diff that doesn't exist until after Step 4. Implements `G-020` Q2's "does the same logic also run as a pre-flight" resolution.

### Changed — T-123

- **`smoke-test-dev.yml` and `smoke-test-prod.yml` now call a shared reusable workflow.** New `.github/workflows/smoke-test.yml` (`workflow_call`) holds the checkout/install/poll-`/health`/run-smoke-test steps both files previously duplicated; each caller keeps its own distinct `on:` trigger and passes its environment's base URL, npm script, and scoped `DATABASE_URL` secret as inputs. Both callers also pick up `.github/actions/setup-repo` (via the reusable workflow, internally) in place of separately-pinned `actions/checkout@v4`/`pnpm/action-setup@v4`/`actions/setup-node@v4` steps, closing the `@v4`/`@v5` drift `T-117`'s audit flagged. No change to trigger conditions, poll behavior, or which secret backs which environment. Implements `T-117` audit finding #1's last bullet.

### Added — T-109

- **Runner-neutral `RunnerCostAdapter` interface for usage capture.** A new `RunnerCostAdapter` (`resolveTicketId()` / `captureRun(projectDir)`) in `packages/core/src/usage-capture/runner-adapter.ts` separates "what did this run cost" from Claude Code's specific transcript-based way of measuring it. `capture-usage.ts`'s `captureUsage` is now a thin wrapper around a `claude-code` implementation of the interface — zero behavior change for existing runs. A degraded runner with no transcript access (e.g. a future Devin lane) can report wall-clock duration and its own vendor-unit cost figure without fabricating a token/cache breakdown; `turnsToGreen`/`humanMessageCount` stay honestly `null` rather than guessed. Building a real non-Claude-Code adapter is deferred until a second runner actually executes a ticket, per `G-020` Notes §3. See `IMPLEMENTATION_NOTES.md` § T-109.

### Removed — T-109

- **`exit-condition-guard` CI job.** Its regex-based citation check couldn't distinguish a report bullet's leading verbatim quote of the ticket's own exit-condition text (which routinely names a file/quotes phrasing as context) from the report's own citation of new evidence, producing false-positive hard failures on reports written in the standard convention. The `reviewer` subagent's existing test-theater check already covers the substantive risk this guard was approximating via regex, making it redundant as well as fragile. See `IMPLEMENTATION_NOTES.md` § T-113.

### Changed — T-121

- **`ci.yml`'s `doc-sync`, `migration-guard`, `mockup-guard`, and `impl-notes-health` jobs merged into one `guards` job.** They previously each ran an independent full-history checkout and independently recomputed the same PR changed-file diff; now there's one shared checkout and one diff computation (exposed as a job output), consumed by four check steps with unchanged pass/fail behavior (including the warning-only vs. hard-fail paths). Each check step runs `if: always()` so one guard failing still lets the others run, matching the old independent-jobs behavior. Cuts three redundant full-history checkouts + diff recomputations per PR. Implements `T-117` audit finding #4.

### Added — T-113

- **CI exit-condition evidence recomputation for ticket-implementation PRs.** A new `exit-condition-guard` CI job checks any `Docs/tickets/reports/` file newly added by a `feat/*`-branch PR: for each bullet in its `## Exit condition check` section that cites a specific test file/name, confirms that file actually exists in the PR's diff and that the named test appears in it — hard-fails on a false citation, passes a bullet naming no specific file/test as "unverifiable mechanically" rather than failing it. Recomputes the report's own claims instead of trusting them; distinct from `T-055` (mechanical diff-stat sync, not a claims check) and `T-114`'s red-check (which runs tests, this only confirms they exist). Logic lives in `packages/ci/src/exit-condition-guard.ts` (unit-tested, same DI'd shape as `gate-guard.ts`/`scope-guard.ts`/`report-guard.ts`). Part of `G-020`'s Q2 "instruction → invariant" candidate set.

### Changed — T-119

- **`ingest_text`'s entity-candidate detection now uses an LLM structured-extraction call instead of the T-078 capitalization heuristic.** `entityService.detectCandidates` replaces `findProperNounSpans`/`guessEntityType` with a single call through `T-118`'s `callClaudeStructured`, keeping its existing signature, contract, and dedup/overlap-with-`detectSpans` behavior. Candidate proposals can now come back `entityType: "unclassified"` for a genuinely ambiguous span (not added to `ENTITY_TYPES` itself); `confirm_ingest_entities` requires a real entity type override per unclassified candidate before creating it — supplying one creates the entity with that type, omitting one rejects just that candidate (not the rest of the batch) via a new `entityTypeOverrides` input and a `rejected` field in the response. T-078's heuristic is left in place, unused, pending a future cleanup ticket. See `IMPLEMENTATION_NOTES.md` § G-021 for the design rationale.

### Added — T-108

- **Observability's `ticket_runs` table gains a `runner` dimension.** Nullable `runner` text column (same placeholder-column pattern as `complexityTier`/`filesChanged`) — every pre-existing row is backfilled to `'claude-code'` via the migration, and `ingest.ts`'s upsert path defaults any future unset value to `'claude-code'` too, so today's ingestion keeps working unchanged. No adapter populates a different value yet; that's `T-109`. Implements `G-020` Q1's runner-dimension option.

### Added — T-114

- **New CI job, "Red-Check (TDD Enforcement)"** — for a ticket-implementation PR, identifies its added/modified test file(s), then requires at least one of them (excluding any that are a pure refactor of existing test code — assertion count unchanged or lower than `develop`'s version) to fail when run against `develop`'s pre-change implementation. Catches a test written after its implementation, or one that doesn't actually exercise new behavior — TDD enforced as a machine-checked CI job rather than only a written rule agents are trusted to follow. Implements `G-020` Q2's red-check candidate (the most novel/highest-risk of the five, deliberately scoped conservatively). Logic in `packages/ci/src/red-check-guard.ts`; entry point `scripts/ci-red-check-guard.sh`.

### Added — T-107

- **`TICKET_SPEC.md` gains a `Runner: claude-code | devin` field**, immediately before `Model:`. `Model:` now only applies when `Runner: claude-code` — a `Runner: devin` ticket omits it, since model selection there is Cognition's concern, not this pipeline's. Every ticket drafted before a second runner exists defaults to `claude-code`. `ticket-writer`'s field-filling step now proposes `Runner` alongside `Model`, same confirmation discipline as `Priority`. Implements `G-020` Q1(b); the field stays documented-but-inert (no executor selection-logic change) until `T-109`'s runner adapter and a real second-runner ticket land.

## [1.1.2] - 2026-08-08

### Added — T-106

- **`EXECUTOR_ROUTINE.md` gains a "Runners" section.** Documents which two steps of the pipeline routine are Claude-Code-specific (the `Model: sonnet, always` line, and Step 7/6's `capture-usage` invocation) and what a different runner should do instead, plus confirms every other step is already runner-neutral. Implements `G-020` Q1(c)'s decision not to fork the routine per runner — the routine stays one document, portable by construction.

### Changed — T-120

- **`ci.yml` / `e2e-release-check.yml` share three new composite actions instead of hand-rolling the same setup steps at five call sites.** `.github/actions/setup-repo` (checkout + pnpm + Node + `pnpm install --frozen-lockfile`), `.github/actions/restore-turbo-cache` (the `.turbo/cache` restore step), and `.github/actions/provision-test-databases` (test-tier DB provisioning/migration) replace the duplicated inline steps T-117's audit flagged (findings #1–#3) — no behavior change, byte-for-byte equivalent to what ran before.

### Added — T-118

- **Reusable structured-output call pattern for Claude.** `llm.service.ts`'s `createLlmService(client?)` gains `callClaudeStructured<T>`, a single-call, DI-testable method that forces Claude to respond via a caller-supplied JSON schema (a `tool_choice`-forced tool call) and returns the parsed, typed result — throwing `LlmApiError` if the response has no matching tool call or a non-object payload. No conversation history, no streaming, no wiring into any feature yet; it exists standalone so `T-119` (entity-candidate detection) and future structured-extraction call sites can share one implementation instead of each rolling their own Anthropic tool-use plumbing.

### Changed — T-147

- **Worktree isolation is now the default for every local session, not just the nightly ticket pipeline.** `T-069`/`T-070` already isolated the executor/`/promote-execute`/`/lineup`/`/morning-review`/`/ungate` into their own `tmp/worktrees/<name>/`; `AGENTS.md` now carries the same rule for any local session (interactive planning, ad hoc audits, anything) before it edits anything, and `session-start.sh` prints a loud reminder when a local session is running in the shared primary checkout instead of a worktree.

### Added — T-112

- **CI report-completeness validator for ticket-implementation PRs.** A new `report-guard` CI job checks any `Docs/tickets/reports/` file newly added by a `feat/*`-branch PR against `REPORT_TEMPLATE.md`'s structure: hard-fails if a required `## ` heading is missing, a leftover `<...>` template placeholder is still present, or the `## Test evidence` section has no recognizable tool-output marker (`PASS`/`FAIL`/`✓`/a file:line pattern) rather than a bare "tests pass" claim. Does not check whether the report's claims are *true* — that's `T-113`/`T-114`. Logic lives in `packages/core/src/ci/report-guard.ts` (unit-tested, same DI'd, `gate-guard.ts`-modeled shape as `T-110`/`T-111`); its `validateReportStructure` helper is generic over the required-headings list so `T-115` can reuse it for `BLOCKED_TEMPLATE.md`'s shape without duplicating the check. Part of `G-020`'s Q2 "instruction → invariant" candidate set.

### Added — T-111

- **CI scope guard for ticket-implementation PRs.** A new `scope-guard` CI job checks a `feat/*`-branch PR's diff against its ticket's declared `Context files:` list: warns (never fails) when the diff touches a path outside both that list and the diff's own newly-created files; hard-fails if the diff touches `Docs/mockups/` or targets a base branch other than `develop`. Logic lives in `packages/core/src/ci/scope-guard.ts` (unit-tested), following the same DI'd, `gate-guard.ts`-modeled shape; `scripts/ci-scope-guard.sh` is the reusable entry point `T-115`'s pre-flight wiring will call. Part of `G-020`'s Q2 "instruction → invariant" candidate set.

### Added — T-104

- **Cite-not-restate rule for `IMPLEMENTATION_NOTES.md` rationale.** Once a piece of rationale is captured in full in `Docs/IMPLEMENTATION_NOTES.md`, rule files (`.claude/rules/*.md`, `AGENTS.md`/`CLAUDE.md`), code comments, and future ticket files must cite it with a one-line pointer instead of restating it in full — closing the gap (`G-013`) that let the same `trustProxy`/Fly-proxy explanation get independently reinvented across three separate files. Tickets/reports already in `done/`/`archive/`/`reports/` stay exempt, as point-in-time records. `.claude/agents/reviewer.md` check 6 now flags this even at a single call site in a diff, not just duplication within the diff itself.

### Added — T-134

- **New `D` complexity tier, a sibling to `S` for tickets whose entire Scope is prose/markdown edits only, regardless of file count.** Unlike `XS`, `D` has no single-file or same-call-site-precedent requirement — a multi-file docs sweep (e.g. T-105's 8-file reference update) qualifies as long as every named file is `.md`. `D` reuses T-084's existing docs/config-only Step 4 branch unchanged (single end-of-work `scripts/run-tests-quiet.sh` pass, no per-checkpoint Red/Green/Refactor) and gets `XS`'s Step 5 reviewer-skip — cutting the nightly executor's cost on legitimately docs-only, multi-file tickets that previously still paid for a full `reviewer` subagent pass.

### Changed — T-105

- **`AGENTS.md` is now the canonical repo constitution** (Principles, Commands, Pointer map, Hard rules, task-source line) — the cross-tool convention spec-kit, Devin, Cursor, and other runners check for by default, per `G-020`'s Q1 resolution. `CLAUDE.md` is now a 6-line pointer at `AGENTS.md`, kept only so Claude Code's own auto-load convention still finds a file at that path. References to the constitution across `Docs/tickets/`'s spec docs and `.claude/skills/`/`.claude/commands/` now cite `AGENTS.md`; `EXECUTOR_ROUTINE.md`'s context-loading steps now read `AGENTS.md` for real content instead of `CLAUDE.md`.

### Added — T-102

- **New `XS` complexity tier, one notch below `S`, for tickets that are a single-line-or-near-single-line change in one existing file, reusing a pattern already implemented at another call site in that exact same file.** `ticket-writer` may only assign it when it can quote both the target and precedent call sites verbatim in the ticket's Scope — otherwise the ticket stays `S`. An `XS` ticket cuts the nightly executor's process weight harder than T-084's docs-only `S` path: Step 3 skips `Context files:` reads entirely (the ticket body already has everything needed), Step 4 collapses to one write-test-and-fix pass instead of per-checkpoint Red/Green/Refactor, and Step 5 skips the `reviewer` subagent invocation altogether — deferred to Alex's own `/morning-review` judgment instead. Targets the same waste T-090 exemplified: a one-line, zero-ambiguity fix that cost $3.11 across 109 turns under the standard process.

### Changed — T-101

- **`update_entity`, `log_session`, and `correct_lore`'s tool descriptions now instruct the calling model to summarize the proposed change to the user in plain language before calling their paired `confirm_*` tool**, retrofitting T-100's agent-interaction policy onto the tools that predate it. `create_campaign`, `create_entity`, `append_entity_note`, and `ingest_text` needed no change (direct writes or already-compliant async guidance).

### Added — T-130

- **The local-worktree (non-remote) branch of the `SessionStart` hook now verifies its own database provisioning instead of trusting it silently succeeded**, matching the verification gate the remote-sandbox branch already had (T-098). A database that's missing, missing a required extension, or has no applied migrations now fails the hook loudly with a diagnostic naming the specific database and unmet criterion, instead of falling through to a confusing test failure minutes into real ticket work. The underlying readiness check is shared between both branches via a new `scripts/db-readiness.sh`, not duplicated. Ships as part of G-035's resolution to make local execution the primary ticket-execution path.
- **Same-PR follow-up:** the local branch also now shares its create-if-missing-then-migrate logic with the remote branch (`ensure_database_provisioned()`, same injected-runner shape as the readiness check above) instead of each branch reimplementing it, and gained the remote branch's T-125 fast-path skip — a healthy worktree's session-start no longer pays a full `db:migrate` per database on every session when nothing changed.

### Added — T-095

- **The nightly executor now ingests every ticket's run into the observability store as part of its own wrap-up.** `EXECUTOR_ROUTINE.md` Step 7 (shipped) and Step 6 (blocked) each run `pnpm --filter @questlog/observability ingest <usage.json> <report>` right after the usage-capture invocation — T-053 built the store and CLI, but nothing called it until now, so every prior ticket's data only reached the store via a manual pull. A missing or unreachable `OBSERVABILITY_DATABASE_URL` logs a warning and exits cleanly instead of failing the wrap-up. `packages/observability`'s `ingest` CLI also now closes its DB connection on every exit path (previously only failure paths did, so a successful run hung instead of exiting) — needed for the command to actually terminate.
- **Uses T-036's established `pnpm --filter <pkg> <script> <args>` invocation form (no `run`, no `--`)** to avoid a known pnpm quirk where `run <script> -- <args>` forwards a literal `--` as the script's first argument on this repo's pnpm version. The CLI also strips a leading `--` defensively, since this ticket's own exit condition (and a habit-typed invocation) still uses the `run ... --` form.
- **Real Neon `observability` branch provisioned and `OBSERVABILITY_DATABASE_URL` set** (M-OBS.3b's Alex-only manual step, completed post-merge-review) — the store is live, not just wired.
- **Post-merge-review fix: `assertValidObservabilityDatabaseUrl` is now exported and directly unit-tested (`db/index.test.ts`), mirroring `packages/core/src/db/index.test.ts`'s existing pattern for its sibling validator.** The gap was a copy-paste bug in `vitest.config.ts` — it set `DATABASE_URL` instead of `OBSERVABILITY_DATABASE_URL` in the test env, so this package's own env var was never available under test. Fixed, with `global-setup.ts` updated to match.

### Added — T-127

- **The nightly executor now bootstraps a new worktree's environment (`pnpm install` + per-worktree Postgres provisioning) as part of picking up a ticket**, instead of discovering it's missing on the first test command. `EXECUTOR_ROUTINE.md` Step 2 (fresh pickup) and Step 1 case 4 (resumed abandoned branch) both call `session-start.sh` immediately after entering the worktree — verified idempotent on a real throwaway worktree run twice.

### Added — T-083

- **`create_entity` now searches ingested lore before creating an entity and offers to seed its description from what it finds.** A match scoring at or above the new `seedConfidenceThreshold` (default `0.7`) drafts a description from the matching chunk(s), stores the contributing chunk ids and confidence as `attributes.seededFrom`, and is cited in the response. A caller-supplied `description` is never overwritten — the seeded draft is appended alongside it as a separate, clearly labeled section. Matches spanning more than one source list each source's excerpt separately rather than blending them, so a conflict between sources is visible instead of silently resolved. Below-threshold (or absent) matches still come back as citations for the caller to review. The tool's response now returns `{ ...entity, citations, confidence, seeded }`. (Post-merge-review fix: the seed/confidence gate now takes the max raw score across all search results instead of assuming the top-ranked-by-recency result was also the top-scoring one.)

### Added — T-100

- **`.claude/rules/mcp.md` now states a standing agent-interaction policy** (resolving `G-012`'s interaction-philosophy axis): any tool description paired with a `confirm_*` tool must instruct the model to narrate the proposed change in plain language before confirming; any tool starting async background work must instruct the model to proactively poll its status tool and narrate progress; and tool errors should be translated into a plain, non-alarming explanation rather than relayed as raw JSON. The error-tone sentence itself now ships in `ONBOARDING_INSTRUCTIONS`, applying to every tool at once. `tool-descriptions.ts` itself is untouched here — retrofitting individual tool descriptions for compliance is T-101.

### Fixed — T-092

- **`POST /api/campaigns/:campaignId/sources/upload` and `POST /api/conversation/:conversationId/stream` now require a valid bearer token**, closing the gap flagged by T-038's security review (both routes were previously reachable by anyone who has or guesses a campaign UUID, no credential required). Reuses `/mcp`'s existing `requireBearerToken` scheme (G-017's resolution) rather than a new, lighter mechanism. Known consequence, accepted by G-017: `SourcesPage` (the one kept v1 web surface) has no token-issuance story of its own yet and will get 401'd on real uploads until a follow-up addresses that — out of scope for this ticket.

### Fixed — T-110 (correction, surfaced while filing T-126)

- **The gate guard (`packages/core/src/ci/gate-guard.ts`) no longer fails a PR for a `backlog/` ticket carrying an unresolved `Gated on:` or unmet `Blocked on:`.** That's `backlog/`'s designed resting state (`TICKET_SPEC.md` Lifecycle, `GATE_SPEC.md`), not a violation — T-110's original scope included `backlog/` in the enforced set with no carve-out, so any newly-drafted `backlog/` ticket following the pipeline's own normal process failed CI. `queue/`, `in-progress/`, and `done/` are unaffected — a ticket is only ever supposed to reach those once both fields have actually cleared.

### Added — T-125

- **`session-start.sh`'s remote-sandbox branch now installs `pgvector` from source, pinned to `0.8.5`, instead of via apt/PGDG.** Investigation (`G-034`) found the sandbox's egress proxy hard-blocks `apt.postgresql.org`/PGDG (403 on the CONNECT tunnel) as a matter of policy, not a fixable config issue, and Ubuntu's own `noble/universe` package (0.6.0) is three minors behind what `hnsw.iterative_scan` needs (`IMPLEMENTATION_NOTES.md` § T-016) — meaning every remote executor session had been silently running against the wrong pgvector version. Building from source against GitHub (confirmed reachable) with `OPTFLAGS=""` (pgvector's default `-march=native` reliably segfaulted Postgres on `CREATE EXTENSION`, confirmed via a from-scratch Docker rebuild) now brings the sandbox to parity with `docker-compose.yml`/`ci.yml`, which already pin `pgvector/pgvector:0.8.5-pg16`.
- **`session-start.sh`'s remote-sandbox branch now fast-paths its per-package `db:migrate` loop** — before running the loop, it checks every `TEST_DB_NAMES` database against the same existence/extensions/migration criteria the end-of-run verification gate already enforces, and skips straight to that gate (with a logged reason) when every database already qualifies. A genuinely fresh or partially-migrated database still runs the full loop unchanged.
- **pnpm's warm-cache install behavior confirmed live** (not assumed) during this ticket's own session — `pnpm install` completed in 928ms with `Lockfile is up to date, resolution step is skipped`, the short-circuit shape pnpm only takes when its content-addressable store and `node_modules` are already warm and consistent with the lockfile.

### Changed — T-084

- **The nightly executor no longer runs a full TDD Red/Green/Refactor cycle on docs/config-only work.** `EXECUTOR_ROUTINE.md` Step 4 now branches on a ticket's `Complexity tier` field: an S-tier ticket whose Scope names only `.md`/config files skips the red-phase ceremony and runs a single end-of-work `pnpm lint && pnpm typecheck && pnpm test` pass instead of looping it per checkpoint — the same regression gate every tier still has to clear, just not repeated for a change with no meaningful "failing test" to write. M/L-tier tickets, and any S-tier ticket that touches application code, are unaffected. `TICKET_SPEC.md`'s Complexity tier field notes now document this as a consequence of the tier, not just its observability purpose.

### Added — T-110

- **New CI job "Gate Guard"** fails a PR whose diff introduces or leaves a ticket file (under `Docs/tickets/{queue,backlog,in-progress,done}/`) carrying an unresolved `Gated on: G-###` (the referenced gate still open under `Docs/tickets/gated/`), or a `Blocked on: T-###` naming a ticket with no file under `Docs/tickets/done/` yet. A ticket that drops the line as part of the same diff (a normal promotion) is unaffected — the check reads the file's landing state, not its history. A `Gated on:` reference that's already resolved and moved to `Docs/tickets/gated/resolved/` warns instead of failing (a sync-bug signal for Alex, not a hard stop). Reusable logic lives in `packages/core/src/ci/gate-guard.ts`; `scripts/ci-gate-guard.sh` is the same entry point a future pre-flight wiring (T-115) will call locally before a run even opens a PR.

### Added — T-116

- **Merge-triggered ticket-status ledger.** A new GitHub Action (`.github/workflows/ticket-status-ledger.yml`) fires when a `feat/<group>/t-###-<slug>` branch merges into `develop` and records `{ ticketId, prNumber, branch, mergedAt }` into `Docs/tickets/.merge-ledger.json`. The nightly executor's pre-flight (`EXECUTOR_ROUTINE.md` Step 1) now reads this ledger first and only falls back to a narrow, per-candidate live GitHub check for anything the ledger doesn't resolve, replacing every run's full paginated PR-history scan and full branch listing with a small file read in the common case. Also supports `workflow_dispatch` with `pr_number`/`dry_run` inputs for on-demand (re-)ledgering of an already-merged PR.

### Added — T-081

- **Entities created via `confirm_ingest_entities` are now marked as machine-extracted.** Each such entity gets `attributes.extractedFrom` set to the id of the source it was detected from, so a reviewer can tell an auto-extracted entity apart from a manually created one. `get_entity` and `list_entities` already return the full entity row, so both surface the marker with no response-shape change. Completes M-EXTRACT.3.

### Added — T-082

- **`contextService.searchChunks(db, { campaignId, query, limit, fetchFn })`** extracts `assemble`'s hybrid vector + keyword search, merge, and recency re-ranking steps into a standalone helper that returns ranked chunks without requiring a `conversationId` or paying for token-budget trimming and formatted context text. `assemble` now calls this helper internally instead of duplicating the logic, so there's exactly one implementation; its existing public behavior and return shape are unchanged. Lays the groundwork for T-083's lore-seeded `create_entity`, which needs ranked candidate chunks outside of a conversation.

### Added — T-117

- **GitHub Actions lean-ness audit** (`Docs/tickets/reports/T-117-github-actions-lean-audit.md`) — recommendations-only review of all four workflow files (`ci.yml`, `e2e-release-check.yml`, `smoke-test-dev.yml`, `smoke-test-prod.yml`) ahead of Milestone 1.1's real enforcement gates. Flags cross-workflow step duplication (Turborepo cache restore, test-DB provisioning, checkout/pnpm/node/install preamble), `@v4`/`@v5` action-version drift with no documented reason, several warning-only checks that can never actually fail a PR, and a handful of smaller sprawl items — each tagged `keep | consolidate | remove | tighten`. No workflow files changed by this ticket; follow-up tickets are Alex's call.

## [1.1.1] - 2026-08-02

### Added — T-080

- **`confirm_ingest_entities` MCP tool** completes the M-EXTRACT.2 preview/confirm pair (`ingest_text`, T-079): given the token from `ingest_text`'s staged `entityCandidates`, it creates one entity per candidate via `entityService.create`, all inside a single transaction, and returns the created entity ids. An optional `candidateIndices` array (0-based positions into the staged candidates list) confirms only a subset instead of all-or-nothing, so a caller can skip an over-broad or misdetected candidate rather than create and later archive it. A second confirm against the same token is rejected, mirroring `confirm_log_session`'s existing claim behavior. `entities` gains a nullable `sourceId` FK (to `sources`, migration `0016_normal_guardian.sql`), set on every entity this tool creates, so each satisfies M-EXTRACT.2's exit condition of linking back to the document it was detected in.

### Added — T-076

- **`confirm_correct_lore` MCP tool** completes the M-CANON preview/confirm pair (`correct_lore`, T-075): given a token from `correct_lore`, it atomically chunks + embeds the correction as new authoritative content and marks every target chunk `superseded`, both inside a single transaction — either both writes land or neither does. Returns the created and superseded chunk ids. A second confirm against the same token is rejected, mirroring `confirm_log_session`'s existing claim behavior. `chunkText`'s `ChunkMeta` gains an explicit third campaign-only anchor variant (no source/session) for corrections that don't originate from an existing source (an `entityId`-only or `chunkIds`-only correction); `correct_lore`'s preview payload now also carries `campaignId`/`sourceId` so confirm can anchor and campaign-scope its writes without trusting anything outside the payload.

### Added — T-079

- **`ingest_text` now stages detected entity candidates as a `write_requests` preview.** Every `ingest_text` call runs T-078's `entityService.detectCandidates` against the ingested text and, when it finds at least one new NPC/location/faction/item/arc, stages the candidate list via `writeRequestService.createPreview` (`toolName: "ingest_entities"`). The tool's response gains `entityCandidates: { token, candidates } | null` alongside the existing `source` field — `null` when no candidates were found, with no `write_requests` row created in that case. The existing source/chunk direct-write path and fire-and-forget embedding are unchanged. Confirming the staged candidates (creating the entities) is a separate tool, T-080, not yet built.

### Fixed — T-073

- **`ticket-writer` and `/ungate`'s ticket/gate-id allocation now claim their `T-###`/`G-###` number by commit-and-push before drafting**, closing the same collision class that hit `G-012`/`G-013` (two concurrent sessions independently scanning for "next free number" and picking the same one). `GATE_SPEC.md`'s new "Claiming a number" section is the canonical definition both gate-stub filers (`ticket-writer` step 3, the executor's mid-ticket gate-filing step) reference; `ticket-writer` step 6 gets the same claim-then-draft instructions inline for `T-###`. `scripts/sim-claim-step.sh` demonstrates the collision and the fix side-by-side. Docs/process-only — no application code changed.

### Fixed — T-090

- **`log_session`'s auto-linking (`detectSpans`) no longer surfaces archived entities.** An archived entity sharing a name with an active one no longer appears as an ambiguous candidate — only the active entity matches; a session mentioning solely an archived entity's name now produces zero spans. No opt-in flag, since this is automatic detection during session logging, not a user-invoked search — an unarchive is required to make a hidden entity linkable again. `log_session`'s preview and `confirm_log_session`'s persisted links both inherit this for free, since neither runs its own candidate query. This closes out M-REMOTE.10 (T-088, T-089, T-090).

### Changed — T-086

- **CI runtime: cross-run Turborepo cache persistence + template-database provisioning.** `ci.yml`/`e2e-release-check.yml` now persist `.turbo/cache` across runs via `actions/cache@v5` (keyed on `pnpm-lock.yaml` plus every first-party `.ts`/`.tsx`/`tsconfig*.json`, with a lockfile-only restore-key fallback), so `lint`/`typecheck`/`build` cache-hit when a run's inputs match a prior run's — `ci.yml` also gained a `pnpm turbo build` step, needed to actually exercise that cache path. Test-tier database provisioning now migrates once per schema family into a template database (`questlog_test_template_core` / `questlog_test_template_observability`) and clones the rest via `CREATE DATABASE ... TEMPLATE` instead of replaying a full migration per database — down from 4 full migration runs to 2 templated migrations + 4 near-instant clones. `test:e2e` stays uncached (`turbo.json`'s `cache: false`); `test` itself has no such override and does cache, replaying a prior real-DB result when its content hash is unchanged.

### Added — T-089

- **`archive_entity`/`unarchive_entity` MCP tools**, each with its own preview/confirm pair (`confirm_archive_entity`/`confirm_unarchive_entity`), exposing T-088's `entityService.archive`/`unarchive`. Mirrors `update_entity`/`confirm_update_entity`'s shape exactly: preview returns a before/after `status` change-set and a token without persisting anything; confirm applies the status change inside `writeRequestService.confirm`'s transaction. A bogus `entityId` 404s at preview (fail-fast) and again at confirm (defense-in-depth against a hand-crafted token); an already-consumed or unknown token 404s without double-applying. Excluding archived entities from `log_session`'s auto-linking (T-090) is the last piece before M-REMOTE.10 closes out.

### Changed — T-085

- **`ticket-writer` now inlines a single relevant `IMPLEMENTATION_NOTES.md` § into new tickets** under an optional `## Relevant background` heading (with heading + capture-date citation), instead of listing the whole append-only notes file in `Context files:` when only one section applies. `TICKET_SPEC.md` documents the field and the executor's staleness-check expectation. Whole-file references remain when multiple sections or the file's general shape are genuinely needed. Forward-looking drafting change only — existing tickets are not rewritten.

### Added — T-088

- **Entities can now be soft-archived.** `entities` gains a `status` column (mirroring `campaigns.status`) plus `entityService.archive`/`unarchive`, both scoped to the owning campaign. Archived entities drop out of `entityService.list` and `getByName`'s fuzzy name search by default; an `includeArchived` flag opts back in, and is now wired through the `list_entities`/`get_entity` MCP tools and their input validators. `getById` (explicit id lookup) and `detectSpans` (`log_session` auto-linking) are unaffected — an archived entity still resolves directly by id and still auto-links during session logging, since archive is a hide-a-mistake mechanism, not a "this is narratively dead" marker (`G-006`). No MCP tools to flip the flag yet — that's T-089; excluding archived entities from `detectSpans` specifically is T-090.

### Added — T-078

- **`entityService.detectCandidates` proposes brand-new entities from free text.** For proper-noun-like capitalized spans not already matched by `detectSpans`, it returns a name, an `ENTITY_TYPES` guess (npc/location/faction/item/arc from surrounding cue words and name suffixes), a description snippet via `extractExcerpt`, and the source span. Heuristic only — no NLP/LLM dependency. Wiring into `ingest_text` is T-079.
- **Fix:** `detectCandidates` no longer proposes duplicate candidates when the same new name is mentioned more than once in the same ingested text — same-name spans now collapse to a single candidate, keyed on the first occurrence.
- **Refactor:** pure span-detection/classification logic moved out of `entity.service.ts` into a new `entity-candidate-detection.service.ts`, following the existing `chunking.service.ts` precedent for DB-free `*.service.ts` files. No behavior change.

### Fixed — T-077

- **`query_lore` no longer surfaces superseded chunks.** Both legs of hybrid search — `search.service.ts`'s vector search and `context.service.ts`'s pg_trgm keyword search — now filter out chunks with `status = "superseded"` (added by T-074), matching the same convention already used by `correct_lore`'s preview lookup. A correction confirmed via `confirm_correct_lore` (T-076) is no longer contradicted by the old text it replaced still showing up in query results. No new flag to re-include superseded chunks — out of scope per `G-014`.

### Changed — T-099

- **`@questlog/core` truncate-lock tests no longer share a Vitest file-worker pool with the rest of the package**, closing intermittent `deadlock detected` flakes on `questlog_test_core`. `global-setup.test.ts` runs in its own serial Vitest project; other core tests keep file parallelism. Worktree `QUESTLOG_PG_PORT` is now passed through turbo's `test` / `test:e2e` tasks, and default-port URL unit tests stub that env unset so exporting a worktree port no longer breaks them. Dev/CI-only — no production behavior changed. Resolves gate `G-019`.

### Added — T-075

- **New `correct_lore` MCP tool (preview half).** Takes correction text plus exactly one of `sourceId` (all that source's non-superseded chunks), `chunkIds` (explicit targets), or `entityId` (attribution only — empty target set). Returns a `write_requests` preview token and payload without marking any chunk superseded. Apply half is T-076 (`confirm_correct_lore`).

### Added — T-056

- **New `update_entity`/`confirm_update_entity` MCP tool pair.** Lets a DM rename an entity, replace its description, or change its type, following the same preview/confirm pattern as `log_session`: `update_entity` previews the proposed before/after field values without persisting anything, and `confirm_update_entity` applies only the fields that were actually provided. Rejects an unresolvable `entityId` (before creating a write request) or an invalid `type`, and cleanly rejects a reused/unknown confirm token — no crashes. `packages/mcp/src/content/onboarding-instructions.ts` now mentions both tools, and their description strings live in `content/tool-descriptions.ts` per T-064's convention.

### Added — T-074

- **`chunks` now has a `status` column (default `"active"`) plus a `chunks_status_idx` btree index.** Mirrors the existing text-status pattern on `sources`/`sessions` so a chunk can later be soft-superseded without deleting it. Schema + journaled migration only — nothing reads or writes the column yet (T-075/T-076/T-077).

### Changed — T-068

- **Unscoped source lookups are now named `getByIdUnscoped`, and MCP tools are guarded against calling them.** `sourceService.getById` was renamed so trusted-internal callers (tRPC routers, import pipeline) and MCP tool handlers can't silently share the same unscoped lookup — MCP tools must keep using `getByIdForCampaign` (or another campaign-scoped method). A lightweight text-scan test under `packages/mcp/src/tools/` fails the suite if any tool file calls a method ending in `Unscoped`, and `.claude/rules/mcp.md` documents the convention.

### Added — T-067

- **`ingest_text` can create a new campaign in the same call.** Previously you had to call `create_campaign` first and then pass its id to `ingest_text` separately. Now `ingest_text` accepts `newCampaign` (the same shape as `create_campaign`'s input) as an alternative to `campaignId` — exactly one of the two must be given — and the response includes the new campaign's id alongside the source's, so a document you attach can spin up its own campaign in one step. Closes out M-REMOTE.8 (agent-interaction strategy for MCP-hooked sessions).

### Changed — T-064

- **MCP tool `description` strings relocated out of each tool file into one aggregated `packages/mcp/src/content/tool-descriptions.ts`.** Pure text move, no behavioral change: every tool's `server.registerTool(...)` call now imports its description from a shared, single-source-of-truth module instead of carrying it as an inline string literal, extending the same pattern T-033's `onboarding-instructions.ts` started. Dev-experience only — no tool name, schema, or handler behavior changed.

### Fixed — T-060

- **Fixed an intermittent FK-violation race in `packages/core`'s test suite.** `global-setup.test.ts`'s two tests exercising `truncateAllTables` mid-suite could occasionally fail with a foreign-key violation when another concurrently-running test file committed a row in the small window between the truncation's `sources` and `campaigns` deletes — a genuine race, not a flaky assertion (root-caused and deterministically reproduced before landing the fix). Both tests now take an explicit table lock before truncating, blocking concurrent writers instead of racing them; a new regression test guards against reintroducing the race. Dev/CI-only — no production behavior changed.

### Fixed — T-098

- **Remote-sandbox session-start no longer fails silently mid-provision.** `.claude/hooks/session-start.sh`'s remote-only Postgres bootstrap now self-heals an interrupted `dpkg` state before installing (the actual cause of T-056's lost session — a boot-time proxy-CA package, unrelated to QuestLog, left mid-configure), attempts pgvector from the PGDG repo (0.8.x, closing T-016's version gap) before falling back to Ubuntu's 0.6.0 package, and ends with a verification gate that confirms every required extension and test database is actually present and migrated — failing loudly with a specific diagnostic instead of the previous silent, `set -e`-driven death that used to surface 20+ turns later as unexplained test failures. Verified end-to-end on a real Ubuntu 24.04 container (matching the sandbox's actual OS), including both the PGDG-success path (confirmed pgvector `0.8.5`) and the Ubuntu-fallback path (confirmed with `apt.postgresql.org` blackholed). Resolves gate `G-018` — see `Docs/tickets/gated/resolved/G-018-remote-sandbox-db-provisioning-strategy.md` for why a hosted-DB (Neon) alternative was rejected.
- **The local-worktree branch of the same hook now actually creates its test databases.** Previously it only relied on `docker-compose.yml`'s default `questlog` database and never created `questlog_test_core`/`_server`/`_mcp`/`_observability` — a fresh per-worktree Postgres volume would fail `db:migrate` for every one of them. Fixed with the same explicit `CREATE DATABASE` step `ci.yml`'s own provisioning already uses. Verified against a genuinely fresh volume (fails before the fix, succeeds after, confirmed twice).

### Fixed — T-096

- **`manually_inspected` no longer false-positives on nearly every executor run.** Cost-report human-message detection was miscounting framework-injected transcript turns — skill/slash-command load expansions and interrupt notices — as if Alex had typed them, so almost every run (including fully autonomous overnight ones) showed up flagged as manually inspected. `summarizeUsage` now recognizes those two shapes and excludes them; a real follow-up message from Alex still trips the flag as before.

### Added — T-053

- **New `packages/observability` workspace package holds a queryable store for executor run/report data.** Own Drizzle schema (`ticket_runs`, `ticket_reports`), own migrations, and its own `OBSERVABILITY_DATABASE_URL`-backed connection — deliberately kept independent of `packages/core`'s campaign-data schema (per `G-003`'s resolution). A pure mapping layer converts T-046's `*.usage.json` artifacts and ticket report markdown into insertable rows; upsert helpers are idempotent on `ticket_id`, and a thin CLI (`packages/observability/src/cli.ts`) ingests a given usage-artifact/report pair. No API endpoints or dashboard yet — those are M-OBS.4/M-OBS.5, blocked on this ticket.

### Added — T-050

- **Tickets now carry a `Complexity tier` and a `Strategy-gate flag`.** `TICKET_SPEC.md`'s fixed ticket format gains two new fields under `Milestone ref:`: `Complexity tier: S | M | L`, sized by a documented rubric (single-file/established-pattern vs. multi-file/new-service vs. new-subsystem/cross-cutting), and `Strategy-gate flag: yes | no`, a provenance marker for whether the ticket only became draftable after resolving a 🎨/🧠 gate. `ticket-writer` now assigns both on every future ticket; `REPORT_TEMPLATE.md` and `EXECUTOR_ROUTINE.md`'s Step 7 echo them into the morning report. Lays the groundwork for tier-relative cost/efficiency metrics (M-OBS.3/M-EFFICIENCY.3) without any DB/API/dashboard changes yet.

### Added — T-047

- **Morning reports now carry a required "Efficiency notes" section.** `REPORT_TEMPLATE.md` and `BLOCKED_TEMPLATE.md` both add a section where the executor self-reports, in its own words, why a run ran long or stayed tight — plus a structured retry log categorizing each Red/Green retry as `environment_setup`, `mechanical_lint_typecheck`, or `genuine_bug_caught_by_test`. This is the qualitative complement to T-046's objective token/cost/duration data. `EXECUTOR_ROUTINE.md` Step 6/7 now reference writing it explicitly.

### Changed — T-094

- **Retired the `.integration.test.ts` naming tier.** All 13 files using that suffix are renamed to plain `*.test.ts` — every vitest config already ran both in the same default tier (splitting out only `*.e2e.test.ts`), so the suffix signaled nothing a config or contributor could rely on. Test conventions docs (`.claude/rules/backend.md`, `.claude/skills/tdd-loop/SKILL.md`, `Docs/DEVELOPMENT_GUIDE.md`) now state plainly that unit and integration tests share one suffix. Resolves gate `G-009` — see `Docs/tickets/gated/resolved/G-009-integration-test-suffix-retire-or-enforce.md` for the full decision.

### Changed — T-093

- **Dropped TypeScript composite project references repo-wide in favor of plain `tsc --noEmit`.** No tsconfig sets `composite: true` or a `references` array anymore — cross-package imports resolve entirely through each package's existing `paths` aliases, which is all that ever made them resolve. Nothing outside `tsc -b` itself consumed the emitted `dist/**`/`.typecheck-out/**` output, and the emit was the root cause of two live bugs: a concurrent-write race between `packages/core`'s and `packages/mcp`'s `tsc -b` runs (`turbo.json`'s `typecheck` task has no `dependsOn`, live-hit in PR #95/T-052), and `apps/server/tsconfig.json`'s `outDir` colliding with its esbuild bundle output. Both are now structurally impossible rather than coordinated around. Resolves gate `G-007` — see `Docs/tickets/gated/resolved/G-007-drop-typescript-composite-project-references.md` for the full decision.

### Fixed — T-038

- **The MCP OAuth passphrase check is now constant-time.** `/authorize` was comparing the submitted passphrase with a plain `!==`, which can leak timing information about the real `MCP_ACCESS_PASSPHRASE`. It now hashes both sides and compares with `crypto.timingSafeEqual`. Found during a security review of the remote-MCP surface (full report: `Docs/tickets/reports/T-038-security-review-remote-mcp-surface.md`); no other severe findings.

### Added — T-087

- **Stale ticket worktrees now get cleaned up automatically instead of accumulating forever.** `scripts/reap-worktree.sh <name> [--force]` tears down a worktree's per-worktree Postgres stack (if any) and removes the git worktree itself, refusing (unless `--force`d) when the worktree has uncommitted changes so nothing in-progress is ever silently discarded. The nightly executor's pre-flight (`EXECUTOR_ROUTINE.md` Step 1) now sweeps every worktree under `tmp/worktrees/` before picking a ticket, reaping any whose branch has an actually-merged PR and leaving everything else untouched — no more manual disk/Docker cleanup after a ticket ships.

## [1.1.0] - 2026-07-30

### Added — T-037

- **Read-only post-merge smoke test against the real deployed prod environment**: a new GitHub Actions workflow (`.github/workflows/smoke-test-prod.yml`), triggered on push to `main` (plus `workflow_dispatch` for on-demand runs), polls `questlog-prod`'s `/health` endpoint until the deploy is live, then runs the same verification script T-036 added (`apps/server/scripts/smoke-test-dev.ts`) via a new `--read-only` flag: only `/health` plus a direct Postgres connection confirming the schema and `vector`/`pg_trgm` extensions are present — no `campaign.create`/`campaign.list` round trip, no writes or deletes against prod under any flag. Requires a new `PROD_DATABASE_URL` GitHub Actions secret Alex still needs to provision — see this ticket's report for the checklist.

### Added — T-072

- **Each git worktree (T-069's per-ticket convention) now runs its own local Postgres instance instead of sharing the primary directory's `:5433`.** `session-start.sh`, when run inside a `tmp/worktrees/T-###/` checkout, derives a per-worktree port and `docker compose` project name from the worktree's identity, brings up that worktree's own compose stack, and migrates its test-tier databases — so concurrent local sessions can never truncate or overwrite each other's test data. `testDbUrl()` now reads the port from `QUESTLOG_PG_PORT` (falling back to 5433) so every existing call site picks up the override automatically. The primary working directory's own Postgres instance is unaffected — still `:5433`, no config change needed. Confirmed local-only: remote/sandboxed sessions each provision their own native Postgres already and never share one process.

### Changed — T-071

- **Every DB-touching package now runs its tests against its own physical database.** `packages/core` and `apps/server` no longer share `questlog_test` — each gets its own (`questlog_test_core`, `questlog_test_server`), matching `questlog_test_mcp`'s existing isolation. `turbo.json`'s `test.dependsOn: ["^test"]`, the ordering that previously stood in for isolation between those two packages, is deleted — no package's test correctness depends on another package's task finishing first anymore, and this closes an identical, previously-unfixed race on the `test:e2e` tier. CI provisioning in `ci.yml`/`e2e-release-check.yml` is now one generic loop over `scripts/test-db-names.sh`'s test-tier name list instead of two separate hardcoded steps — a new database only needs one name added to that list, not a new workflow step.

### Fixed — session-start.sh develop-sync guard

- **`.claude/hooks/session-start.sh`'s develop-sync guard (T-041) now runs on local sessions too, not just remote.** It was gated behind `CLAUDE_CODE_REMOTE=true`, so a local session sitting on a stale branch never got its `.claude/commands`/`.claude/skills` files refreshed from `origin/develop` — surfaced when a `/ticket-writer` session on a branch cut before a fix merged gave stale instructions, then a later `/morning-review` session hit the same already-fixed bug because the primary directory was left on that stale branch. The guard's per-file merge-base safety check (never overwrites a branch's own committed edits) is ungated now; each actual refresh also prints to stdout instead of applying silently.
- **Added a second, independent guard: local `develop` now self-heals when stale.** Commands like `/promote`/`/promote-execute` commit small changes directly onto `develop` in the primary directory, then push — with no fast-forward step first. If local `develop` was behind (a different ticket merged since), that push was rejected non-fast-forward with no documented recovery (observed live: `/promote-execute T-072` hit this after T-071 merged). `session-start.sh` now fast-forwards local `develop` to `origin/develop` at session start, but only when it's unambiguously safe: exactly on `develop`, with a clean working tree. Any other branch, or a dirty `develop`, is left untouched.

### Changed — T-070

- **The rest of the ticket pipeline now follows T-069's worktree convention.** `/lineup` no longer force-checkouts `develop` while calling itself "read-only" — it genuinely is now, reading ticket files straight off `origin/develop`, so a scheduled `/lineup` run can no longer clobber a concurrent executor session's working tree; `COMMANDS.md` updated to reflect why it's safe to schedule unattended. `/morning-review` no longer `git stash -u`s before checking out a PR branch (which could sweep up a different session's uncommitted work) — it now reviews in its own worktree instead. `/ungate` cuts its `gates/<gate-slug>` branch in its own worktree too (the naming convention itself is unchanged). `ticket-writer`'s branch setup converted the same way.

### Changed — T-069

- **Nightly/interactive ticket execution is now concurrency-safe.** Each execution session works in its own git worktree (`tmp/worktrees/T-###/`), created from `origin/develop`, instead of checking out in the shared primary working directory — a locally-run `/executor` or `/promote-execute` no longer yanks the working tree out from under a concurrent session. Ticket pickup now pushes the feature branch immediately as a claim, turning the existing dedup check into a real mutex; resuming an apparently-abandoned claim now waits for a 6-hour staleness window before treating it as safe to take over, so two sessions can no longer land on the same branch. Usage-capture attribution across concurrent sessions no longer depends on a stashed `tmp/.session-context.json` file at all — that mechanism was removed in favor of deriving the transcript directly from `CLAUDE_CODE_SESSION_ID`, which sidesteps the collision problem entirely instead of just keying around it. Scheduled agent's prompt updated by Alex to match.

### Added — T-066

- **`create_campaign` MCP tool**: a DM working entirely through an MCP-connected Claude session can now start a new campaign directly from chat, instead of needing the web app's `CampaignCreateModal`. Direct write (additive-only, no preview/confirm) — validates via the existing `CampaignCreateInput` schema (name, description, theme, gameSystem) and calls the existing `campaignService.create`. `list_campaigns`-first onboarding guidance now also mentions `create_campaign` for starting a new one.

### Changed — T-065

- **`ingest_text` supports multi-call chunked ingestion**: `IngestTextInput` gained optional `sourceId` and `final` fields. Passing the `source.id` echoed back from a previous call appends the new text onto that still-`pending` source instead of creating a new one; passing `final: false` skips triggering processing until the last chunk. This lets Claude split a large attached document's extracted text across several `ingest_text` calls instead of needing to regenerate the whole document as one JSON argument.
- **`ingest_text`'s description and the onboarding instructions now tell the model to extract attached documents directly**: when the user attaches a PDF/DOCX/image, the model should extract its text and call `ingest_text` itself rather than asking the user to paste it, splitting long documents across multiple calls via `sourceId`/`final`. Both also now instruct the model to proactively call `get_source_status` after ingesting and narrate progress to the user.
- **Fixed (review follow-up):** `ingest_text` now rejects a `sourceId` from another campaign (404 instead of silently appending), and the MCP tool layer now maps `ValidationError` to a structured `{ error: { code: "VALIDATION_ERROR", message } }` response instead of an unstructured error string.

### Fixed

- **A malformed `DATABASE_URL` now fails with a clear, actionable error instead of a raw Node internals crash**: the first real run of `smoke-test-dev.ts` against `questlog-dev` hit exactly this — `DEV_DATABASE_URL` wasn't a valid connection string, and `packages/core/src/db/index.ts` passed it straight to `postgres()` unchecked, surfacing as `TypeError: Invalid URL` deep inside `node:internal/url` with no mention of `DATABASE_URL` at all. A new `assertValidDatabaseUrl` export validates presence and shape (parses as a URL, `postgres:`/`postgresql:` protocol) up front, so every consumer of `packages/core/src/db/index.ts` — not just this smoke test — gets a message naming the actual problem.

### Added — T-036

- **Post-merge smoke test against the real deployed dev environment**: a new GitHub Actions workflow (`.github/workflows/smoke-test-dev.yml`), triggered on push to `develop` (plus `workflow_dispatch` for on-demand runs), polls `questlog-dev`'s `/health` endpoint until the deploy is live, then runs `apps/server/scripts/smoke-test-dev.ts` — a real `campaign.create` -> `campaign.list` round trip through the live tRPC API, a direct Postgres connection confirming the schema and `vector`/`pg_trgm` extensions are present on the real database, then a scoped cleanup delete of the throwaway campaign. Separate from `ci.yml`'s per-PR gate entirely; a failure here means the code that just merged doesn't actually work against real infra, not a PR gate. Requires a new `DEV_DATABASE_URL` GitHub Actions secret Alex still needs to provision — see this ticket's report for the checklist.

### Changed — T-036 (hardening, folded in)

- **Smoke-test's expected-tables/extensions lists are now derived, not hand-copied**: `apps/server/scripts/smoke-test-dev.ts` no longer hardcodes `EXPECTED_TABLES`/`EXPECTED_EXTENSIONS` — both are now derived from the schema barrel and a new `REQUIRED_EXTENSIONS` export on `migrate.ts` respectively, so adding/renaming a table or extension never requires touching this file. Also fixed `packages/core/src/db/schema/schema.integration.test.ts`'s own pre-existing hardcoded list, which had already silently drifted (missing `write_requests`/`mcp_oauth_*`). Added a migration-drift check (journal entry count vs. applied count in `drizzle.__drizzle_migrations`) to `smoke-test-dev.ts` as an additional, low-maintenance layer of confidence that a deploy's migrations actually ran.

### Fixed — T-036 (folded in)

- **`capture-usage`'s env-derived fallback never actually found a transcript**: `resolveHookPayloadFromEnv` (`packages/core/src/observability/capture-usage.ts`) joined `claudeHomeDir` directly with `"projects"` instead of `".claude", "projects"`, so it silently failed to find any transcript and usage capture no-opped for every session relying on this fallback (introduced by T-035's follow-up fix, see `Docs/IMPLEMENTATION_NOTES.md`). Fixed; test fixtures corrected to match the real `~/.claude/projects` layout instead of mirroring the bug.

### Changed — T-035

- **`fly.dev.toml` and `Docs/DEPLOY_SETUP_CHECKLIST.md` updated for dev auto-deploy**: `fly.dev.toml`'s header comment no longer claims dev is manual-deploy-only — it now documents that `questlog-dev` will auto-deploy on every merge to `develop` via Fly's native GitHub integration, mirroring how `questlog-prod` already auto-deploys on merge to `main`. A new §3.1 subsection in `DEPLOY_SETUP_CHECKLIST.md` lists the exact Alex-only dashboard steps (connect `questlog-dev`'s GitHub integration to `develop`, confirm it builds via `fly.dev.toml`). The actual Fly dashboard connection is Alex-only and not done by this ticket — the milestone checkbox (M-CICD.1) stays unflipped until Alex confirms a real `develop` merge triggered a dev deploy.
- **`Docs/DEPLOY_SETUP_CHECKLIST.md`'s remaining stale "dev is manual-only" claims fixed**: two lines (§2, §3) still contradicted the new §3.1 after the above shipped — both now point at §3.1 instead of restating the outdated claim.
- **`capture-usage` no longer hard-fails when `tmp/.session-context.json` is missing**: `EXECUTOR_ROUTINE.md`'s manual usage-capture invocation went stdin-empty during this ticket's own run (session-start.sh's stash didn't survive to Step 7). `capture-usage.ts`'s entry point now falls back to deriving `{transcript_path, session_id}` directly from `CLAUDE_CODE_SESSION_ID` and the `~/.claude/projects` transcript layout when stdin is empty, instead of only working when the stash file is present. See `Docs/IMPLEMENTATION_NOTES.md` § T-035 follow-up for why this is a fallback, not a replacement.

### Added — T-034

- **`apps/server/scripts/verify-mcp-remote.ts`**: exercises the full remote MCP flow — discover, register, authorize, token exchange, connect, `tools/list`, then every one of the 12 registered tools with minimal valid input — against a real deployed base URL, using its own throwaway campaign it creates and cleans up. Run it with `MCP_ACCESS_PASSPHRASE`/`DATABASE_URL` set in the environment: `pnpm --filter @questlog/server exec tsx scripts/verify-mcp-remote.ts https://questlog-dev.fly.dev`.

### Fixed — T-034

- **`questlog-dev` deploy was broken since T-042**: the release-command migration and the app itself failed to boot in production (`ERR_MODULE_NOT_FOUND` for `postgres`/`@anthropic-ai/sdk`/`mammoth`/`pdf-parse`) — T-042's package split had dropped all four from `apps/server/package.json`'s runtime dependencies. Restored, with a new regression test (`apps/server/scripts/build.deps.test.ts`) guarding it going forward.
- **OAuth discovery advertised `http://` instead of `https://` behind Fly's proxy**: Fastify now trusts `X-Forwarded-Proto` (`trustProxy: true`), so `/.well-known/oauth-authorization-server` and related endpoints advertise the correct scheme — a real client's `POST /register` against the previously-wrong `http://` URL was silently losing its body to a redirect.
- **`questlog-dev`'s MCP session store isn't multi-machine-safe**: scaled to a single machine — the in-memory session `Map` (`mcp-http.routes.ts`) has no cross-machine affinity or shared backing store, so a session's follow-up request could 404 with "Session not found" if load-balanced to a different machine than the one that created it. Documented in `Docs/IMPLEMENTATION_NOTES.md` § T-034 for whoever scales this app back up.

### Added — T-033

- **MCP onboarding surface**: the server now sets the MCP protocol's `instructions` field (surfaced by well-behaved clients, including Claude, at connection time without the user asking) to a short summary of QuestLog's workflow — start with `list_campaigns`, then `ingest_text`/`log_session` to bring in content, `create_entity`/`append_entity_note` to author directly, and the read tools to look things up. A new no-input `help` tool returns the identical text on demand, for clients that don't surface `instructions` or a mid-conversation refresher. Both draw from one shared constant (`packages/mcp/src/content/onboarding-instructions.ts`) so they can't drift apart.

### Fixed — T-033

- **Usage-capture hook no longer tracks non-ticket sessions**: the `Stop` hook fires on every turn of an interactive session, not just at session end, and was writing an `empty-run-<session_id>.usage.json` artifact for every one of them — pure noise for sessions with no ticket work to attribute (review, planning, one-off chat). `resolveArtifactPath`/`captureUsage` (`packages/core/src/observability/`) now write nothing at all when no `tmp/.active-ticket` marker is present, short-circuiting before the transcript is even read. Autonomous nightly runs and manual ticket-execution sessions are unaffected — both set that marker the same way, so both still get tracked.

### Fixed — T-062

- **Executor marker/stash files moved out of `.claude/` to `tmp/`**: T-061's `.claude/.active-ticket`/`.claude/.session-context.json` stalled every unattended nightly run — the harness gates any write under `.claude/` behind an interactive confirmation (it holds hooks/commands that execute with elevated trust), and there's no one present overnight to approve it. Both files now live at `tmp/.active-ticket`/`tmp/.session-context.json` instead — a plain scratch location (already used by T-048's test logs) with no such gate. Purely a path change: the marker/stash semantics, `resolveTicketId`'s signature, and `EXECUTOR_ROUTINE.md`'s Step 1/2/6/7 flow are all unchanged.

### Changed — T-049

- **`EXECUTOR_ROUTINE.md` Step 3 now explicitly instructs single-turn, parallel context-file reads**: the nightly executor reads `CLAUDE.md` and every file in a ticket's `Context files:` field as parallel tool calls within one assistant turn instead of spreading them sequentially across turns — each extra turn re-sends the entire growing conversation, and the full file list is already known upfront from the ticket, so there's no reason to pay that cost. No change to which files get read or to Step 4's necessarily-sequential TDD loop.

### Fixed — T-061

- **Usage-capture artifact attribution and commit timing**: `capture-usage`'s ticket attribution used to guess (last 5 commit subjects, else newest file in `done/`/`blocked/`) instead of reading an explicit signal, and the artifact was only ever written by the `Stop` hook, which doesn't fire until after an autonomous run's wrap-up has already committed and opened the PR — so the artifact never made it into the PR, and any unrelated session's guess could silently overwrite a real ticket's cost record. `.claude/hooks/session-start.sh` now stashes each session's `transcript_path`/`session_id` to `.claude/.session-context.json` on every start; `Docs/tickets/EXECUTOR_ROUTINE.md` Step 2 (and Step 1's resume path) writes the ticket id it's actively working to `.claude/.active-ticket`; Step 7 invokes `capture-usage` directly and synchronously before its wrap-up commit, using that stash, then clears the marker. `resolveTicketId` (`packages/core/src/observability/usage-summary.ts`) now just reads the marker's contents — the commit-subject/mtime heuristic is gone entirely, so a session with no active ticket work correctly falls through to `empty_run: true` instead of attributing to whatever ticket was most recently touched.

### Added — T-046

- **Executor usage-capture `Stop` hook**: a new Claude Code `Stop` hook (`.claude/hooks/stop-usage-capture.sh`) fires at the end of every session in this repo and writes a per-run usage artifact to `Docs/tickets/cost-reports/T-###.usage.json` (committed as part of the executor's Step 7 wrap-up) — token totals (input/output/cache-write/cache-read), wall-clock duration, turn count, `turns_to_green` (the turn where the TDD loop first went fully green, distinct from total turn count), theoretical Sonnet 5 cost at both intro and standard metered rates, and `manually_inspected`/`human_message_count` flags so a session Alex interrupted mid-run can be excluded from future trend data instead of silently skewing it. Reviewer-subagent transcripts are summed separately and kept independently visible alongside the main run's totals, with a combined `total_system_cost_usd`. Cache-write cost is priced from each turn's own 5m/1h TTL split (`usage.cache_creation.ephemeral_5m_input_tokens`/`ephemeral_1h_input_tokens`) when present, falling back to a 1h assumption only for older transcripts that predate the split. No ticket id resolves (e.g. a no-ticket-queued run) → tagged `empty_run: true` instead of erroring. New `packages/core/src/observability/` module (`usage-summary.ts`, `pricing.ts`, `artifact.ts`, `capture-usage.ts`) holds all the parsing/computation logic as pure, Vitest-tested functions; the hook itself and its new `pnpm --filter @questlog/server capture-usage` script are thin wrappers. `/morning-review` surfaces this data in a new Cost section. No database writes — that's a separate, gated milestone task (M-OBS.3).

### Added — T-048

- **`scripts/run-tests-quiet.sh` filters the executor's TDD-loop test output**: wraps `pnpm lint && pnpm typecheck && pnpm test` in the same fail-fast order, capturing each stage's full output to `tmp/test-logs/{lint,typecheck,test}.log`. On full success it prints only a one-line summary per stage (`lint: pass (N warnings)`, `typecheck: pass`, `test: pass (N passed)`, aggregating pass counts across every monorepo package) instead of the full output — cutting the intermediate-run noise a Red/Green/Refactor loop otherwise re-injects into context on every passing iteration. The lint summary surfaces Biome's own warning count even when the stage passes (Biome's `check` exits 0 for warn-severity diagnostics, so they'd otherwise be silently swallowed by the pass line). On any stage failing, it prints that stage's full captured output (earlier passing stages still just show their summary) and exits non-zero, so nothing needed to debug is lost. `Docs/tickets/EXECUTOR_ROUTINE.md` Step 4 now calls this script instead of the raw chain.

### Changed — T-045

- **Every live milestone doc now lives in `Docs/milestones/`**: `MILESTONES_V1_MCP.md`, `MILESTONES_V1_1_MCP.md`, and `MILESTONES_V1_2_MCP.md` moved from `Docs/` root alongside `MILESTONES_V2.md` (added by T-044), so the whole milestone-doc family sits in one purpose-built directory instead of scattered at root next to unrelated docs. Every cross-reference across the repo — `README.md`, `CLAUDE.md`, `Docs/README.md`, `Docs/PRD.md`, the ticket-pipeline meta-docs (`TICKET_SPEC.md`, `GATE_SPEC.md`, `EXECUTOR_ROUTINE.md`, `REPORT_TEMPLATE.md`), `.claude/rules/frontend.md` (and its `.cursor/` mirror), `.claude/skills/ticket-writer/SKILL.md`, `.github/pull_request_template.md`, and every currently-active ticket/gate file in `queue/`, `backlog/`, `in-progress/`, and `gated/` — now points at the new paths. The stray `Docs/.~lock.QuestLog_API_Cost_Model.xlsx#` lock artifact is also gone. `Docs/mockups/README.md`'s one stale reference was deliberately left unfixed — `CLAUDE.md`'s "never modify files under `Docs/mockups/`" hard rule and CI's `mockup-guard` job override the ticket's own instruction to fix it; see `Docs/tickets/reports/T-045-fix-milestone-doc-cross-references.md` for the full note to Alex.

### Added — T-044

- **`Docs/milestones/MILESTONES_V2.md` replaces `MILESTONES_PT1.md`/`PT2.md`**: every milestone deferred to v2 (4.3, 5.1–5.4, 6.1–6.3, 7.1–7.3, 8.1–8.3, 9.1/9.2/9.4/9.5/9.6, 10–19) is re-audited against the post-MCP-pivot codebase and reproduced in one current file — not a transcript of the old ones. Reconciled each task against what already shipped as its MCP equivalent (4.3 vs. `log_session`/M-MCP.3, 6.1–6.3 vs. `prep_brief`/M-MCP.4), confirmed which PT1/PT2 references still hold (`Rail.tsx`, `SessionEditor`'s `window.prompt`, the `EmberPlaceholder` mascot stub), and flagged where deferred v2 scope and in-flight v1.1/v1.2 work could otherwise be confused (Milestone 10's LLM/CI observability vs. `MILESTONES_V1_2_MCP.md`'s executor-observability work; Milestone 19's per-campaign token guardrails vs. that same doc's executor cost model). `MILESTONES_PT1.md`/`PT2.md` are deleted — v2 is deferred, not abandoned, per `Docs/tickets/gated/resolved/G-002-milestone-docs-cleanup-and-ticketing-reference-audit.md`.

### Added — G-010

- **Tickets now carry a `Priority: P0 | P1 | P2` field** (default `P1`), set by Alex per ticket at `ticket-writer` draft time — backfilled onto all 21 existing `queue/`/`backlog/` tickets. The nightly executor's candidate-list build (`Docs/tickets/EXECUTOR_ROUTINE.md` Step 1) now sorts by tier first, numeric `T-###` id as the tiebreak; `Blocked on:`/`Gated on:` remain absolute gates evaluated before priority is ever considered. New commands: `/promote T-### [tier]` (bump a ticket's priority — defaults to one tier up, or set an explicit tier directly), `/promote-execute T-###` (promote to `P0` and immediately execute, subject to the same eligibility/dedup checks as a normal run), `/lineup` (read-only daily report: next 3 eligible tickets, open PRs awaiting review, full backlog snapshot), and `/command-help` (lists every pipeline command). New `Docs/tickets/COMMANDS.md` is the canonical quick-read index of all of them. See `Docs/tickets/gated/resolved/G-010-ticket-prioritization-mechanism.md` for the full rationale.

### Fixed — T-052

- **`packages/mcp`'s test suite now truncates its own `questlog_test_mcp` database between runs, not `apps/server`'s `questlog_test`**: Vitest applies each package's `test.env` to `process.env` only *after* `globalSetup` runs, so `global-setup.ts`'s `setup()` — which read `process.env.DATABASE_URL` — always resolved the wrong database for any package whose `vitest.config.ts` pointed `test.env.DATABASE_URL` somewhere other than the default (`packages/mcp`'s case). `setup()` now accepts the `TestProject` Vitest passes to every `globalSetup` function and reads the already-resolved `test.env` value straight from `project.config.env` instead (`Docs/IMPLEMENTATION_NOTES.md` § T-031/T-052).

### Added — T-032

- **DMs can now create entities and add notes to them directly from a session, not just look them up**: `create_entity` creates a new NPC, location, faction, item, or arc from a name, type, and optional description; `append_entity_note` adds a note to an existing entity's description without overwriting what's already there (e.g. "Lyra mentioned she used to serve under Baron Voss"). Both are direct writes with no preview/confirm step, per G-001's additive-only-writes exemption — creating a row or appending a note never mutates prior content. There's still no way to rename an entity, replace its description, or delete/archive one — that's unbuilt surface, not a bug.

### Added — T-031

- **Seed a campaign's knowledge base straight from a chat, with `ingest_text`**: paste text or markdown directly into a Claude session and it's chunked + embedded into the campaign's knowledge base, the same pipeline the web app's file-upload flow uses — no REST upload endpoint needed. Returns immediately with the new source's id and `pending` status; processing continues in the background. A companion `get_source_status` tool checks progress afterward (`pending` → `extracting` → `chunking` → `embedding` → `done`/`error`). Both tools are additive-only direct writes with no preview/confirm step, per G-001's resolution.

### Added — T-030

- **The MCP tool set is now reachable remotely, over HTTP**: `POST /mcp` on `apps/server` speaks the MCP Streamable HTTP transport (`@modelcontextprotocol/sdk`'s `StreamableHTTPServerTransport`), serving the same 7 tools (`query_lore`, `prep_brief`, `list_campaigns`, `list_entities`, `get_entity`, `log_session`, `confirm_log_session`) `apps/mcp-stdio` already serves locally over stdio. Every request to `/mcp` requires a valid bearer token from T-029's OAuth shim — a missing or invalid token gets a `401` with a `WWW-Authenticate` header pointing at the new `GET /.well-known/oauth-protected-resource` endpoint (RFC 9728 Protected Resource Metadata), so a compliant client can discover how to authenticate. A scripted MCP client can now complete the full remote handshake — discover, register, authorize, exchange for a token, connect, `tools/list` — against a locally-running `apps/server` instance (`apps/server/scripts/mcp-remote-smoke.ts`). Connecting a real Claude.ai Custom Connector to a deployed instance is a later ticket (M-REMOTE.7).

### Added — T-029

- **`apps/server` now speaks OAuth 2.1 for the future remote MCP endpoint**: `GET /.well-known/oauth-authorization-server` (RFC 8414 metadata), `POST /register` (RFC 7591 Dynamic Client Registration, public clients only), `GET`/`POST /authorize` (a minimal passphrase-gated HTML form issuing PKCE-bound, single-use authorization codes), and `POST /token` (`authorization_code` and `refresh_token` grants, with refresh-token rotation). Scoped to a single fixed identity gated by a new `MCP_ACCESS_PASSPHRASE` env var, not a real multi-user identity provider — see `Docs/IMPLEMENTATION_NOTES.md` § T-029 for why. New `mcp_oauth_clients`/`mcp_oauth_codes`/`mcp_oauth_tokens` tables store all bearer secrets (codes, access tokens, refresh tokens) as SHA-256 hashes, never raw. This ticket only builds the authorization-server half — mounting the protected MCP transport itself is a later ticket (M-REMOTE.3).

### Added — G-002

- **Milestone tasks now carry a `(T-###)`/`(Gated on: G-###)` tag recording their ticketing state**: `ticket-writer` and `/ungate` write this tag onto a milestone task's own line the moment a ticket is drafted or a gate is filed/resolved, so a scan of the milestone doc alone shows what's ticketed, what's gated, and what's neither — see `Docs/tickets/TICKET_SPEC.md`'s new "Milestone-doc annotations" section. `ticket-writer` also gained a "what's next" mode: invoked with no milestone named, it scans the active milestone doc for the first task that's neither done nor ticketed and proposes it, instead of requiring a slice to be named up front. Also resolved `Docs/tickets/gated/G-002` (milestone-doc sprawl): `MILESTONES_PT1.md`/`PT2.md`'s still-relevant v2 detail will be consolidated into a new `Docs/MILESTONES_V2.md` (T-044), and every stale cross-reference to them fixed (T-045) — see `Docs/IMPLEMENTATION_NOTES.md` § G-002.

### Changed — T-043

- **The local test-database name list is no longer hand-copied in three places**: `scripts/test-db-names.sh` is now the single source of truth for `questlog`/`questlog_test`/`questlog_test_mcp`, sourced by `ci.yml`, `e2e-release-check.yml`, and `.claude/hooks/session-start.sh` (see `Docs/IMPLEMENTATION_NOTES.md` § T-027).

### Changed — T-042

- **The domain layer and MCP tool-registration layer now live in their own packages, not inside `apps/server`**: `apps/server/src/{db,services,lib}` moved wholesale to `packages/core` (`@questlog/core`), and `apps/server/src/mcp` (the tool-registration layer T-028 relocated there) moved to `packages/mcp` (`@questlog/mcp`). `apps/mcp` renamed to `apps/mcp-stdio` (`@questlog/mcp-stdio`) — freed up by the `@questlog/mcp` package name — and is now honestly just a thin stdio-transport binary wiring `packages/mcp`'s tools to a real client, not where the MCP logic itself lives. `apps/server` keeps `routers/`, `server.ts`, `trpc.ts`, `main.ts`, and `process-imports.ts`, importing the moved code from `@questlog/core/...`. Purely structural — no tool name, description, input schema, service behavior, or response/error shape changed. This is what actually lets `apps/server` mount an HTTP transport for the same tool set (a later M-REMOTE ticket) without the circular TypeScript project reference that made T-028's `apps/server`-nested layout only a stopgap (`Docs/IMPLEMENTATION_NOTES.md` § T-042).

### Changed — T-028

- **The MCP tool-registration layer now lives in `apps/server`, not `apps/mcp`**: all 7 MCP tools (`query_lore`, `prep_brief`, `list_campaigns`, `list_entities`, `get_entity`, `log_session`, `confirm_log_session`), their shared `ToolDeps`/`withToolErrors` helpers, and the `createMcpServer` factory moved to `apps/server/src/mcp/`. `apps/mcp` is now a thin stdio-only wrapper importing `createMcpServer` from `@questlog/server/mcp/server.js`. Purely structural — no tool name, description, input schema, or response/error shape changed. This unblocks a later ticket mounting the same tool set over an HTTP transport directly on `apps/server`, which would otherwise require a circular TypeScript project reference (`Docs/IMPLEMENTATION_NOTES.md` § T-028).

### Fixed — T-041

- **`.claude/hooks/session-start.sh`'s develop-sync step no longer clobbers a branch's own committed-but-unmerged changes**: the guard used to check only `git status --porcelain` (uncommitted diffs) before overwriting `.claude/commands`/`.claude/skills` with `origin/develop`'s copy, so a file this branch had already committed — but not yet merged into `develop` — got silently reverted to develop's stale version on the next session resume. Now compares each candidate file against the branch's merge-base with `origin/develop` (`git diff --quiet "$merge_base" -- "$file"`) and only syncs files identical to that merge-base copy, so an untouched file still syncs but a committed-or-uncommitted local edit never does (`Docs/IMPLEMENTATION_NOTES.md` § T-041).

### Added — T-025

- **Test/dev database tooling now refuses to run against a real hosted database**: `assertLocalDatabaseUrl()` (`apps/server/src/db/test-db-url.ts`) guards `createTestDb()` and the global test-setup table-truncation step, throwing a clear, password-redacted error if `DATABASE_URL` doesn't resolve to `localhost`/`127.0.0.1` — defense-in-depth against ever pointing an automated test run at a real Neon dev or prod branch. Confirmed separately, by inspecting this repo's actual CI/sandbox configuration, that no automated path currently holds a real database credential to misuse in the first place (`Docs/IMPLEMENTATION_NOTES.md` § T-025).

### Added — T-024

- **`apps/server` can now be built into a standalone, deployable artifact**: `apps/server/scripts/build.mjs` bundles `src/main.ts` and `src/db/migrate.ts` with esbuild (following `apps/mcp`'s T-019 precedent), producing `dist/main.js` and `dist/db/migrate.js` that run under plain `node` without `tsx` or workspace path resolution. `apps/server/Dockerfile` packages this into a container image; `.dockerignore` scopes the build context.
- **Generated (not yet applied) deploy configuration for two Fly.io environments**: `fly.dev.toml` and `fly.prod.toml` (Dockerfile-based, explicit `release_command` migration step, `/health` check), and `deploy/env.dev.example` / `deploy/env.prod.example` documenting every env var each environment needs — real values are never committed, only names and structure. Prod auto-deploy on push to `main` uses Fly's own GitHub integration (connected directly in Fly's dashboard), not a custom GitHub Actions workflow — see `Docs/DEPLOY_SETUP_CHECKLIST.md` §3.
- **`Docs/DEPLOY_SETUP_CHECKLIST.md`**: the manual sequence only Alex can run — Neon project/branch creation, Fly app creation, secrets, first deploy, GitHub Actions token — cross-referencing every automated artifact above by file path. Nothing under M-MCP.5 is actually live yet; this ticket produces configuration only, per its own scope.

### Changed — T-024

- **`pgvector/pgvector` Docker image pinned to `0.8.5-pg16`** (`docker-compose.yml`, `.github/workflows/ci.yml`, `.github/workflows/e2e-release-check.yml`), replacing the rolling `pg16` tag — carries forward T-023's finding that the previously-installed `0.6.0` predates `hnsw.iterative_scan` (added in `0.8.0`, relevant to T-016's campaign-filtered ANN recall cliff).
- **`dotenv` moved from `apps/server`'s `devDependencies` to `dependencies`**: needed in the production image now that `apps/server` has a real bundled/deployed runtime (previously only ever run via `tsx`, which doesn't distinguish dev/prod dependencies).

### Fixed — T-027

- **`apps/mcp`'s real-API e2e suite no longer shares a database with `apps/server`'s**: `pnpm turbo test:e2e` runs both packages' e2e suites concurrently with no ordering between them, and `apps/mcp/vitest.e2e.config.ts` was still pointed at `apps/server`'s `questlog_test` — the identical race T-026 fixed for the default test tier, still live in the e2e tier. Repointed at its own `questlog_test_mcp`, with the matching provisioning step added to `e2e-release-check.yml`.

### Changed — T-027

- **Collapsed the hand-typed local Postgres connection string out of TypeScript config/helper files**: `postgresql://questlog:questlog@localhost:5433/<dbname>` was duplicated across both packages' vitest configs, `test-helpers.ts`, `migrate.ts`, `global-setup.ts`, and `drizzle.config.ts`. All now build it from one shared `apps/server/src/db/test-db-url.ts` (`testDbUrl(dbname)`) so the host/port/credentials only need to change in one place.
- **Documented the test-DB isolation model as a deliberate design, not oversight**: new `IMPLEMENTATION_NOTES.md` entry explaining why `turbo.json` has no `dependsOn` between packages' test tasks (isolation comes from separate physical databases, not execution ordering) and why per-package test isolation is truncate-once-per-run + manual `campaignId` scoping rather than transaction-per-test rollback. Also documents `apps/mcp`'s cross-app `globalSetup` import from `apps/server` as intentional, matching its established service-import pattern, not a boundary violation.

### Changed — T-026

- **`apps/mcp`'s test suite now runs against its own isolated database (`questlog_test_mcp`)** instead of sharing `apps/server`'s `questlog_test`: `turbo test` runs both packages' suites as separate concurrent processes with no ordering between them, so an unscoped mutation in one could previously hit a live FK reference from a row the other suite had just committed (see `IMPLEMENTATION_NOTES.md` § T-018). CI and the remote sandbox's session-start hook now provision and migrate `questlog_test_mcp` alongside the existing databases.
- **`list_campaigns`'s "empty" test now asserts a literal empty array** from a genuinely empty `campaigns` table, replacing the archived-campaign-exclusion substitute T-018 added as a workaround for the shared-database race.

### Added — T-019

- **`apps/mcp/README.md`**: the full setup path for connecting a real MCP client (Claude Desktop or otherwise) to QuestLog — prerequisites, bootstrap, build, the Claude Desktop `mcpServers` config snippet, and a "first conversation" walkthrough (`list_campaigns` → `query_lore`).
- **`pnpm --filter @questlog/mcp smoke`**: a stdio smoke test that spawns the *built* `dist/main.js` the same way a real MCP client would, performs the MCP initialize handshake, and asserts all 7 tools are present — machine-checkable proof the documented setup actually boots, distinct from the existing in-process test suite.

### Fixed — T-019

- **`apps/mcp`'s built `dist/main.js` now actually runs under plain `node`**: previously `pnpm --filter @questlog/mcp build` (plain `tsc`) produced a `dist/main.js` that immediately crashed with `ERR_MODULE_NOT_FOUND` when run directly — `@questlog/server`/`@questlog/shared` are consumed as workspace TypeScript source with no build step of their own, and `tsc` never rewrites their bare-specifier imports into something Node can resolve. `apps/mcp`'s build now bundles via `esbuild` instead, which resolves both packages straight from source. See `IMPLEMENTATION_NOTES.md` § T-019 for the full investigation.

### Added — T-018

- **New `list_campaigns` MCP tool**: read-only, no-input tool returning every active campaign's `id`, `name`, `description`, `theme`, `gameSystem`, and `status`. Every other MCP tool requires a `campaignId`, but nothing over MCP could previously discover one — a DM connecting a fresh MCP client had no way to find their campaign's id without leaving the conversation. Mirrors the existing `list_entities` tool's pattern; delegates straight to the existing `campaignService.list(db)`, no new business logic.

### Added — T-016

- **`chunks.embedding` cosine search has an ANN index available**: added `chunks_embedding_hnsw_idx` (`hnsw`, `vector_cosine_ops`) so `search.service.ts`'s `<=>` query is no longer forced into an exact brute-force scan of every campaign's chunks. `hnsw` chosen over `ivfflat` — no training-data-at-build-time requirement, better fit for a table that grows incrementally rather than via bulk load. **Caveat (see `IMPLEMENTATION_NOTES.md` for full evidence):** the installed pgvector (`0.6.0`) predates iterative index scan (added in `0.8.0`), so once a campaign is a small-enough fraction of the whole `chunks` table that the planner prefers this index over the existing `campaign_id` bitmap scan, a filtered query can return far fewer rows than its `LIMIT` — reproduced directly, not theoretical. Flagged for Alex as a decision item, not silently shipped.

### Changed — T-015

- **`query_lore`/`prep_brief`'s keyword-search leg made indexable**: `context.service.ts`'s `keywordSearch` (the pg_trgm half of hybrid search, run on every `query_lore`/`prep_brief` call) previously filtered with `similarity(chunks.content, query) > threshold` as a direct function call, which can never use a GIN trgm index — confirmed the same class of limitation T-012 found for `word_similarity`, but for `similarity()` this time. Added a `chunks_content_trgm_idx` GIN index and added the indexable `content % query` operator alongside the original strict `similarity(...) > threshold` filter (`%`'s own truth test is `>=`, not `>`, so it's used only to reach the index for candidate generation, not as a replacement for the exact threshold check; `pg_trgm.similarity_threshold` is scoped via `SET LOCAL` inside a transaction, never the global config). Confirmed `similarity()` is genuinely symmetric for this use case (unlike `word_similarity`), so the net result is a pure query-plan change — identical scores, identical ranking, no behavior change for callers. See `IMPLEMENTATION_NOTES.md` for the full EXPLAIN evidence and an honest caveat: the speedup is data-dependent at production chunk size, not uniformly dramatic.

### Added — T-014

- **`campaign_id` btree indexes added across every campaign-scoped table** (`sessions`, `entities`, `entity_relationships`, `sources`, `chunks`, `conversations`, `write_requests`): previously only `entities.name` had an index, so every campaign-scoped query Seq Scanned its full table to find one campaign's rows. Invisible at today's single-user scale; matters once multiple users each have multiple campaigns and total rows per table grow independently of any one campaign's slice. No behavior change — same query results, cheaper query plans. Closes the scaling gap T-012's won't-fix investigation identified.

### Changed — T-013

- **`prep_brief`'s "Likely NPCs" now reads confirmed entity links from `session_entities` instead of re-scanning session text on every call:** `brief.service.ts` previously ran `entityService.detectSpans` against each recent session's content at read time, re-deriving the same links `confirm_log_session` already persisted at write time. It now joins `session_entities` → `entities` for the recent-session window directly. Behavior change: a session's NPC mentions only surface in "Likely NPCs" if that session went through `log_session`/`confirm_log_session` (which link entities) — a session created via the raw service layer with no linked entities no longer falls back to text matching, even if its content mentions an NPC by name.

### Changed — T-011

- **`entity.service.ts`'s fuzzy-candidate lookup consolidated onto a shared, Drizzle-typed helper:** `detectSpans` and `getByName` each ran a near-identical raw `db.execute` query for the `word_similarity` pre-filter, then manually cast every field out of `Record<string, unknown>` — `getByName` in particular hand-mapped each column (`dm_notes` → `dmNotes`, etc.). Both now call a new private `findWordSimilarityCandidates` helper built on Drizzle's typed query builder (mirroring `search.service.ts`'s existing raw-`sql`-fragment-inside-query-builder pattern), so both callers get fully-typed, already-camelCased rows with zero manual casting. No change to matching behavior, thresholds, or index usage.

### Added — T-004

- **`log_session` now chunks + embeds session content and consolidates entity state, closing M-MCP.3**: `confirm_log_session` chunks the confirmed session's content and embeds it into pgvector (`chunks.sessionId` set, `sourceId` null) inside the same transaction as the session write, so a logged session's content becomes queryable via `query_lore` immediately after confirm. A deterministic (non-AI) consolidation step also appends a short excerpt around each confirmed entity mention to that entity's existing `description` — append-only, never overwriting prior notes.
- **`log_session` preview payload extended** (`apps/mcp/src/tools/log-session.ts`) with `chunkPreview: { count, firstChunkExcerpt }` and `entityConsolidation: Array<{entityId, appendedNote, attribution}>`, so the DM can see what would be chunked/appended before confirming; an unconfirmed preview still writes nothing.
- **`chunking.service.ts` / `embedding.service.ts` generalized** to anchor a chunk to either a `sourceId` (source documents) or a `sessionId` (session logs), not only the former.
- **`entityService.appendToDescription`** (`apps/server/src/services/entity.service.ts`): appends a note to an entity's `description` with a blank-line separator, or sets it if empty. Paired with a new `extractExcerpt` helper that pulls the sentence surrounding a detected entity span.

### Added — T-003

- **`log_session` / `confirm_log_session` MCP tools** (`apps/mcp`): `log_session(campaignId, content, title?, summary?, tags?, sessionNumber?, date?)` detects entity mentions in the session content and returns a preview of the session record plus confirmed/ambiguous entity links, without writing anything; `confirm_log_session(token)` takes the returned token and, in a single transaction, creates the session record and links its confirmed entities. Follows the mandatory preview/confirm/audit pattern (`.claude/rules/mcp.md`) — nothing is persisted until confirm, and a second confirm with an already-used token returns a structured not-found error instead of writing a duplicate session.
- **`session_entities` table** (`apps/server/src/db/schema/tables.ts`): links a session to the entities detected in it, recording the match type (`confirmed` | `ambiguous`) each link was made with.
- **`sessionService.linkEntities`** (`apps/server/src/services/session.service.ts`): inserts one `session_entities` row per entity span passed in.
- **`LogSessionInput` / `ConfirmLogSessionInput` Zod schemas** (`packages/shared`) for the two new MCP tools.

### Changed — T-010

- **MCP tool registrations split into `apps/mcp/src/tools/`:** each of the four MCP tools (`query_lore`, `prep_brief`, `list_entities`, `get_entity`) now lives in its own file exporting a `register*(server, deps)` function, instead of being inlined in `apps/mcp/src/server.ts`. A new shared `withToolErrors` wrapper (`apps/mcp/src/tools/errors.ts`) replaces the duplicated per-tool `try/catch`-`NotFoundError` blocks with one source of the `{ isError: true, content: [...] }` error shape. `server.ts` now just constructs the `McpServer` and calls each `register*` function — adding a future tool is one new file plus one line there. Purely structural: no change to any tool's name, description, input schema, or response/error payload.

### Changed — T-009

- **Test-DB client construction deduplicated:** `createTestDb()` (`apps/server/src/db/test-helpers.ts`) now accepts an optional `{ max? }` argument (defaulting to today's `{ max: 1 }` behavior) and also returns the raw postgres.js `client`. `write-request.service.test.ts`'s cross-connection concurrency/claim-step tests and `global-setup.test.ts` now call `createTestDb()` instead of each hand-rolling their own `postgres()`/`drizzle()` client with slightly different, duplicated settings.

### Changed — T-008

- **`session-start.sh` `DATABASE_URL` parsing:** replaced the hand-written regex (which required an explicit port and silently truncated passwords containing an unescaped `@`) with a real URL parser (`node -e` using the `URL` class). A `DATABASE_URL` with no explicit port now defaults to `5432` instead of failing to parse, and passwords containing `@` are extracted intact.

### Changed — T-007

- **`writeRequestService.confirm` claim step** (`apps/server/src/services/write-request.service.ts`): replaced the `SELECT ... FOR UPDATE` row lock (held across the caller-supplied `applyFn`) with an atomic conditional `UPDATE` that claims the row via a new `claimed_at` column before `applyFn` runs. Preserves the existing single-use/no-double-apply and throw-then-retry guarantees without depending on a caller correctly requesting a lock, and no longer holds a lock across `applyFn`'s I/O.

### Added — T-006

- **`get_entity` / `list_entities` MCP tools** (`apps/mcp`): `list_entities(campaignId, type?)` lists a campaign's entities, optionally filtered by type; `get_entity(campaignId, entityId?, name?)` looks up a single entity by id or by fuzzy name match (reuses the existing pg_trgm matching from entity detection), returning a structured not-found error instead of throwing when nothing matches
- **`entityService.getById` / `getByName`** (`apps/server/src/services/entity.service.ts`): campaign-scoped id lookup and fuzzy name lookup (`word_similarity` pre-filter + trigram-similarity confirmation, same threshold as `detectSpans`); `entityService.list` now accepts an optional `type` filter
- **`ListEntitiesInput` / `GetEntityInput` Zod schemas** (`packages/shared`) for the two new MCP tools

### Added — T-005

- **`prep_brief` MCP tool**: read-only session prep brief for a campaign, combining a "Previously on" recap of the most recent 1-2 sessions, active plot threads derived from session tags (closed by a `resolved:<tag>` marker), a "Likely NPCs" list of NPC entities mentioned in recent session content, and quick links mirroring those NPCs. Loose ends & suggested follow-ups return a stable empty-with-explanation shape — both require agent analysis that's out of scope for v1.

### Added — T-002

- **Preview/confirm/audit plumbing for MCP writes** (`apps/server/src/services/write-request.service.ts`): a generic mechanism backing every MCP write tool. `createPreview` stages a proposed change-set and returns a single-use confirmation token; `confirm` re-validates the token, applies the change inside a transaction, and records the result — a confirmed row doubles as the audit entry, no separate audit table needed. New `write_requests` table (migration `0007_funny_true_believers.sql`). This is infrastructure only — `log_session` itself doesn't use it yet (T-003/T-004).

### Fixed

- **Navigation after agent chat / conversation:** `campaign/:id` uses **`<Outlet />`**; **`AppShell`** derives **`campaignId`** from **`location.pathname`** (not `useMatch`). **Context** tablet overlay scrim no longer covers the **nav rail** (`left: var(--rail-width)`); rail gets **`z-index: 25`**. Agent chat cites sync via **`agentChatContextSources`**; **`AppShell`** renders **one** **`ContextPanel`** on chat routes (no per-tick React node replacement). Leaving **`/campaign/:id/chat`** clears **`agentChatContextSources`**. **`useMediaQuery`** tolerates environments without **`window.matchMedia`** (e.g. jsdom)
- **Chat infinite re-render:** **`useChat`** returned a **new `messages` array every render** (and bumped streaming message ids every frame), so **`ChatPage`**’s sync to **`setAgentChatContextSources`** re-fired endlessly. **`useChat`** now memoizes merged **`messages`**, uses a **stable streaming assistant id**, and exposes **`agentContextSources`** derived only from **`getMessages` query data** so context updates stop looping

### Changed

- **`db:migrate` / `process-imports`:** `tsx` now uses **`--env-file=../../.env`** so migrations run against the same **`DATABASE_URL`** as `pnpm dev` (avoids applying migrations to the fallback DB while the app uses repo-root `.env`)
- **Turborepo** on **2.9.x**; `turbo.json` uses a versioned `$schema` URL aligned with the lockfile for editor validation
- **Docs:** local dev URLs (5173 / 3000 / `VITE_API_URL`), DEVELOPMENT_GUIDE first-time setup uses `db:migrate` and Postgres **5433**; README troubleshooting for API connection / **EADDRINUSE**
- **Server:** clearer startup error when **PORT** is already in use; `.env.example` documents optional **PORT**

### Added — M4.2 Entity Detection & Linking

- **Entity matching service** (`apps/server/src/services/entity.service.ts`): two-phase pg_trgm fuzzy matching (`word_similarity` pre-filter + per-token `similarity`) against campaign entities; greedy longest-span selection; dismissed text exclusion
- **Entity tRPC router** with two procedures: `entity.detectSpans` (query) and `entity.create` (mutation)
- **`dismissedEntityTexts` column** on `sessions` table (JSONB `string[]`, default `[]`) with Drizzle migration `0006_entity_linking_schema.sql`
- **GIN trigram index** `entities_name_trgm_idx` on `entities.name` for sub-millisecond candidate pre-filtering
- **`EntityHighlight` TipTap Mark extension** with attributes (entityId, entityType, state, candidates); `setEntitySpans` and `setEntityMark` commands; CSS class rendering for all states (confirmed/ambiguous/unlinked)
- **`useEntityDetection` hook**: 500ms debounced detection, paragraph-range span merging, `detectedSpans` + `unresolvedCount` state
- **Entity highlight CSS** (`features/session-log/styles/entity-highlight.css`): per-state × per-type CSS classes with underline styling and hover states
- **RGB triplet tokens** (`--ent-{type}-rgb`) added to `index.css` `:root` for `rgba()` usage in entity highlight CSS
- **`EntityActionBar` component** with Link/Create/Dismiss buttons, 80ms hover delay, above/below placement flip at 60px from editor top, Escape key to close
- **`EntityQuickCreatePopover` component**: type selector row (NPC/Faction/Location/Item/Arc), tinted header, name + description inputs, "Create {type}" button calling `entity.create`
- **`DetectedEntitiesPanel` component**: collapsible type-group sections, status dots (confirmed/ambiguous/unlinked), click-to-scroll and click-to-action-bar routing, empty state
- **Save-time validation warning** in `FinalizeForm`: soft `unresolvedCount` warning block with "Review in editor" button; warning never blocks save; `unresolvedCount` threaded from `useEntityDetection` → `SessionEditor` → parent pages → `FinalizeForm`

### Added — M4.5 Polish: Style Audit & Component Reorganization

- **4 half-step spacing tokens** added to `index.css`: `--space-0-5` (2px), `--space-1-5` (6px), `--space-2-5` (10px), `--space-3-5` (14px) — fills gaps in the 4px grid used by button/chip/input padding
- Applied new tokens across all callsites: `buttonAccent`, `buttonSecondary`, `buttonGhost`, `buttonAction`, `chipBase`, `inputField`, `sourceChipBase`, `panelSection`, `panelSectionTitle`, `floatingMenu` presets, and all inline styles in feature files that previously used bare pixel values
- **Component directory restructured** from half-done `primitives/feedback/layout` split to a complete by-kind layout:
  - `components/buttons/` — Button, IconButton, Chip
  - `components/inputs/` — FormField, Input, Select, Textarea
  - `components/surfaces/` — Card, EntityAvatar
  - `components/feedback/` — Alert
  - `components/overlays/` — Modal
  - `components/layout/` — PageScaffold
  - `components/utilities/` — ErrorBoundary, PlaceholderPage
- All 24+ callsite import paths updated; typecheck, lint, and all 219 tests remain green

### Added — M4.5 UI Component Library Refactor

- **`Button`** component (`accent`, `secondary`, `ghost`, `action` variants; `sm`/`md` sizes; `loading` state; `forwardRef`-compatible `Input`)
- **`IconButton`** component (sizes 24/28/32; `active` state; `hoverStyle`/`pressStyle` override props for ChatInput's custom hover behaviors)
- **`Input`** component (focus ring via tokens; `background` override prop for modal contexts; `forwardRef` support)
- **`FormField`** component (label, hint, error display; `compact` prop for dense forms; `htmlFor` for accessibility)
- **`Chip`** component (entity/tag/badge/pill/source variants; entity colors via `entityAvatarColors`)
- **`Card`** component (`as` prop: div/button/link; `hoverable` prop encapsulates hover state)
- **`Alert`** component (`role=alert`; title + message + optional retry button)
- **`EntityAvatar`** component (entity type → color mapping; configurable size; first-initial display)
- **`Modal`** component (overlay scrim; `<dialog>`; Escape/backdrop close; auto-focus first input; `aria-labelledby`)
- All 25+ callsites across feature components migrated; no raw style-preset spreads remain in feature code

### Added — M4.1 Session CRUD & Editor Foundation

- **`/campaign/:id/sessions/:sessionId`** route renders `SessionEditorPage` (Notion-style main-area editor at 720px centered column)
- **Dock button** (⇥) in `SessionEditorPage` header: flushes autosave, docks the session, navigates back to the session list
- **`DockedSessionPanel`** wired into `AppShell` third column — renders at `var(--dock-width)` (360px) when `isDocked=true`, suppressing the side panel
- **`isDocked` / `dockSession` / `undock`** added to `CampaignChromeContext`; dock and panel are mutually exclusive in the grid
- **`flushSave`** added to `useSessionAutoSave` — cancels the debounce timer and immediately persists pending content
- **`buttonSmallAccent` / `buttonSmallSecondary`** style presets in `components/styles.ts` (compact header buttons used across all session editor surfaces)
- Session card clicks in `SessionListPage` now navigate to `/campaign/:id/sessions/:id` instead of opening the notes panel

### Changed — Session notes UX (4.1 follow-up)

- Session **date** and **session number** persist on **blur** (no per-keystroke `session.update` spam)
- **Full-width notes mode**: expand (⤢) from the panel header moves the session editor into the main column; **Back to panel** restores the right panel; layout resets when the route or campaign changes
- **Rail**: Session logs icon shows a **7px draft indicator** (`--ent-faction`) when any session in the campaign is `draft` (`session.list` with 60s stale time)
- **Slash menu**: ArrowUp/ArrowDown, Enter to apply, Escape to dismiss; keyboard highlight matches hover
- **Finalize session** form uses a **CSS grid height reveal** (`0fr` → `1fr`) with reduced-motion respect
- Milestone **9.6** (Polish & Deploy): deferred **TipTap link URL popover** replacing `window.prompt`

### Added — Milestone 4.1: Session CRUD & Editor Foundation

- Migration `0005_nosy_proudstar.sql`: `sessions.status` (`draft` | `finalized`, default `draft`)
- `session` tRPC router: `create`, `getById`, `list`, `update`, `finalize`; Zod inputs in `packages/shared`
- `session.service.ts`: auto-increment `sessionNumber` per campaign, list ordered by `sessionNumber` descending
- TipTap v3 editor (`SessionEditor`): StarterKit (H2/H3 only), placeholder, bubble menu (bold/italic/strike/code/link/heading), floating slash menu for block inserts; content stored as TipTap JSON string in `sessions.content`
- `CampaignChromeProvider` + right-hand `Panel` (Context / Session notes tabs) in `AppShell`; agent chat syncs cited sources into chrome state for the Context tab; ⌘⇧N opens notes; panel width uses `--panel-width`
- `SessionNotesPanel` with metadata, `FinalizeForm`, debounced server auto-save (2s) via `session.update`, footer save status
- `SessionListPage` at `/campaign/:id/sessions`; tests: `session.service.test.ts`, `session.integration.test.ts`, `SessionEditor.test.tsx`
- Resilience: `campaign.service` list-order test now asserts relative positions of created rows (extra campaigns in DB no longer break the assertion)

### Added — Milestone 1: Foundation

#### 1.1 — Project Scaffolding
- Initialized pnpm workspace with Turborepo orchestration
- Created `apps/web` (React + Vite + Tailwind CSS v4), `apps/server` (Fastify + tRPC), `packages/shared` (shared types and validators)
- Configured `tsconfig.base.json` with strict TypeScript, path aliases, and TypeScript project references for cross-package imports
- Set up Biome for linting and formatting (tabs, double quotes, semicolons)
- Configured Vitest in both `apps/web` and `apps/server`
- Created `docker-compose.yml` with Postgres 16 + pgvector on port 5433
- Created `.env.example` with all required environment variables

#### 1.2 — Database Schema & Migrations
- Configured Drizzle ORM with `postgres.js` driver (ESM-native, better performance than `pg`)
- Defined core schemas: `campaigns`, `sessions`, `entities`, `entity_relationships`, `sources`, `chunks` (with pgvector `vector(1024)` column), `conversations`, `messages`
- Enabled `pgvector` and `pg_trgm` extensions in initial migration
- Generated and applied initial migration (`0000_dear_mephisto.sql`)
- Integration tests: table existence and basic CRUD on `campaigns` verified

#### 1.3 — tRPC Boilerplate & Campaign CRUD
- Set up tRPC Fastify plugin with context factory
- Built `campaign` router: `create`, `getById`, `list`, `update`, `archive`
- Built `campaign.service.ts` with full CRUD business logic
- Zod schemas for campaign input/output in `packages/shared`
- Connected React Query + tRPC client in frontend (`apps/web/src/lib/trpc.ts`)
- superjson transformer on both client and server for Date serialization
- `VITE_API_URL` env var wires frontend to backend URL

#### 1.4 — Frontend Shell & Routing
- Installed React Router; created route structure for `/campaigns`, `/campaign/:id`, `/campaign/:id/chat`, and other nav items
- Built `AppShell.tsx` three-panel layout shell
- Campaign list page with tRPC data fetching (loading/error/empty states)
- Campaign create modal (name, description, theme selection)
- Dark mode CSS custom properties foundation

#### 1.5 — Design System Migration
- Replaced parchment/amber/brown token palette with entity-driven color system (deep navy-black base, cool blue-green entity accents)
- Replaced 240px text `Sidebar.tsx` with 56px icon-only `Rail.tsx` navigation
- Four-plane depth hierarchy: `--bg-void`, `--bg-surface`, `--bg-elevated`, `--bg-focal`
- Entity type colors as the accent system: NPC (#60b8ff), Faction (#40d8a0), Location (#a0b8ff), Item (#80d8d8), Story Arc (#c0a0ff)
- Added Crimson Pro (display), DM Sans (body), JetBrains Mono (mono) via Google Fonts
- Shared style presets in `components/styles.ts` (`buttonAccent`, `entityLink`, `elevatedCard`, etc.)
- Added `Docs/DESIGN_SYSTEM.md` as canonical visual reference (supersedes PRD §5)

### Added — Milestone 2: Import & Knowledge Base

#### 2.1 — File Upload & Text Extraction
- File upload endpoint via Fastify multipart form handling
- Text extraction service supporting PDF (`pdf-parse`), Markdown (passthrough), TXT (passthrough), DOCX (`mammoth`)
- Pluggable `StorageProvider` interface: `createLocalStorage()` for production, `createMemoryStorage()` for tests
- `sources` table tracks uploaded files with `mimeType`, `storageKey`, status, and extraction metadata
- Frontend: drag-and-drop `FileDropZone`, paste text input, `ImportQueue` with processing status, `SourceList`, `DuplicatePrompt` for collision detection
- Applied migration `0001_add_sources_mime_storage.sql`

#### 2.2 — Chunking & Embedding Pipeline
- `chunking.service.ts`: splits extracted text into ~500–1000 token chunks respecting section headers and paragraph boundaries
- `embedding.service.ts`: calls Voyage AI API, stores 1024-dimension vectors in `chunks` table via pgvector
- `voyage.client.ts`: shared HTTP client owning API URL, model name, auth header, and batch size constant
- Background processing: `process-imports.ts` worker polls `sources` table by status; `processSource` is idempotent for re-runs
- Embedding model: Voyage AI `voyage-4-lite` (upgraded from `voyage-3` in sub-task 2.3.5; same $0.02/MTok, improved MTEB scores, same 1024-dimension output — no schema migration required)
- `input_type: "document"` / `input_type: "query"` differentiation for improved RAG retrieval precision

#### 2.3 — Vector Similarity Search
- `search.service.ts`: embeds a query with `input_type: "query"`, retrieves top-k similar chunks filtered by campaign using cosine similarity via pgvector operators
- `routers/search.ts`: tRPC endpoint for debugging and testing the search pipeline end-to-end
- Integration tests: upload → embed → search → verify relevant chunks returned and filtered by campaign

### Added — Milestone 3: Agent Conversation

#### 3.1 — Context Assembly
- `context.service.ts`: given a query and campaign ID, assembles a structured context block from four sources: campaign metadata (5%), vector search results (60%), entity data (10%), conversation history (25%)
- **Hybrid search**: vector search (Voyage AI) and `pg_trgm` keyword search run in parallel; results merged via `mergeSearchResults()` before recency re-ranking. Chunks in both result sets receive a 0.1 score boost. Addresses retrieval failure for proper nouns and early-session lore.
- Candidate pool expanded to 40 chunks (from 20) before budget trimming
- Recency weighting: `combinedScore = 0.9 × cosineSimilarity + 0.1 × recencyScore` (normalized within result set)
- Token budget: 100,000 token default, configurable per-call; greedy packing skips over-budget chunks without breaking
- `AssembledContext.confidence`: average cosine similarity of included chunks, returned on every call
- All configuration constants centralized in exported `CONTEXT_CONFIG` object
- Token estimation: `ceil(words / 0.75)` — fast approximation, no tiktoken dependency

#### 3.2 — LLM Integration & Streaming
- `llm.service.ts`: Anthropic SDK integration using `createLlmService()` factory for dependency injection
- `conversation.service.ts`: orchestrates full chat flow (validate → persist → assemble context → call LLM → persist response)
- `routers/conversation.ts`: tRPC router with `chat` mutation and `list`/`getById` queries
- System prompt construction includes campaign context and behavioral guardrails
- Conversation persistence: messages saved to `conversations` and `messages` tables with source citations as typed `MessageSource[]` JSONB
- `LLM_CONFIG` constants: model (`claude-sonnet-4-20250514`), `maxTokens` (4096), `maxHistoryMessages` (40)
- Transaction wrapping: entire chat sequence in a single DB transaction — rolls back user message if LLM call fails, preventing orphaned messages
- **Streaming SSE** (sub-task 3.2.5): `POST /api/conversation/:conversationId/stream` Fastify route delivers text deltas via Server-Sent Events (`delta`, `done`, `error` event types). Optimistic persistence: saves user message, streams LLM response, saves assistant message on completion. Non-streaming `chat` tRPC mutation preserved as fallback.
- Applied migration `0002_add_messages_token_usage.sql`
- Error differentiation: `LlmApiError` with `statusCode`/`errorType`; 429/529 → `TOO_MANY_REQUESTS`; all others → `INTERNAL_SERVER_ERROR`

### Added — Milestone 3.3.5: Documentation Infrastructure

- Created `CLAUDE.md` at repo root: standing AI session instructions, startup sequence, TDD rule, visual/strategy check gates, code review trigger, known false positives, doc update obligations
- Created `.github/pull_request_template.md`: PR checklist covering code quality, tests, types, database, frontend, documentation, migration guard, and breaking changes
- Created `.github/workflows/ci.yml`: lint + typecheck + full test suite; blocks on `test.only`/`test.skip`; doc-sync warning when code changes without Docs/ changes; migration guard enforces SQL migration when schema files change; actionlint validates workflow YAML
- Created `CHANGELOG.md`: retrospective changelog covering all shipped work to date (this file)
- Added acceptance criteria blocks to all nine feature sections in `Docs/PRD.md §4`
- Created `e2e/` directory with four Playwright stub files — one per PRD §3 user flow — as living documentation of intended behavior
- Updated `Docs/MILESTONES.md`: checked off tasks 2.3 and 3.2 (implemented but not marked complete); inserted task 3.3.5; extended copy-paste template with doc update obligations
- Updated `Docs/DEVELOPMENT_GUIDE.md`: fixed stale sidebar/three-panel layout reference; added pre-merge doc obligations to §7 completion checklist; added §11 (Spec-Anchored AI Development)
- Updated `Docs/IMPLEMENTATION_NOTES.md`: documented `conversation.service.ts` test gap, confirmed storage/voyage client test omissions are intentional, noted 2.3/3.2 check-off correction

### Changed — Milestone 3.3.6: CI Test Enforcement Enabled

- `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` configured as repository secrets; Anthropic key has a $10/month spend cap
- Removed `continue-on-error: true` from the Test step in `.github/workflows/ci.yml`; CI now hard-fails on test failures
- Removed `continue-on-error: true` from the Run database migrations step (migrations run against the Postgres service container, no secrets needed); fixed the misleading TODO comment that implied DB secrets were required
- Split `Docs/MILESTONES.md` into `Docs/MILESTONES_PT1.md` (Milestones 1–9) and `Docs/MILESTONES_PT2.md` (Milestones 10–19 + task template) so each part fits within tool read limits; updated `CLAUDE.md` startup sequence to source from PT1 and acknowledge PT2
- Checked off task 3.3 (Chat UI) in `Docs/MILESTONES_PT1.md` — code shipped in PR #16 but the box was never ticked

### Fixed — Migration Journal & `chunks.embedding` Dimension

- Added migration `0003_resize_chunks_embedding_to_1024.sql`: drops and recreates `chunks.embedding` as `vector(1024)` to match Voyage `voyage-3`. The original `0000` migration created `vector(1536)`; the schema definition was later changed to 1024 but no ALTER migration was generated, so CI got a fresh 1536 column and every chunk-insert test failed with a dimension mismatch
- Registered migration `0002_add_messages_token_usage` in `_journal.json` — the SQL file existed on disk but was never journaled, so `db:migrate` skipped it. Local dev was unaffected because the schema had been `drizzle-kit push`'d directly, but CI ran from the journal and ended up missing both columns
- Documented the `db:migrate` vs `drizzle-kit push` discipline in `Docs/IMPLEMENTATION_NOTES.md` to prevent recurrence
- Both bugs were latent and masked by `continue-on-error: true` on the CI Test step until milestone 3.3.6 removed it
