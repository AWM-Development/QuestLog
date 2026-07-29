# G-008 — Test-database topology: uniform per-package physical DBs, or keep the shared-DB-plus-ordering hybrid?

Gate type: 🧠 strategy

Milestone ref: none — pipeline/tooling hygiene, same category as T-026/T-027/T-043/T-052; surfaced by the same 2026-07-26 audit as G-007

Opened: 2026-07-26 — by Alex/agent during the same standalone test-infrastructure audit

Context files (load ONLY these):
  - packages/core/src/db/global-setup.ts, packages/core/src/db/test-db-url.ts, packages/core/src/db/test-helpers.ts
  - packages/core/vitest.config.ts, packages/core/vitest.e2e.config.ts, packages/mcp/vitest.config.ts, apps/server/vitest.config.ts, apps/server/vitest.e2e.config.ts, apps/mcp-stdio/vitest.config.ts, apps/mcp-stdio/vitest.e2e.config.ts
  - scripts/test-db-names.sh
  - turbo.json (the `test` task's `dependsOn: ["^test"]`)
  - Docs/IMPLEMENTATION_NOTES.md §T-018, §T-026/T-027 ("Test-DB infrastructure isolation model"), §T-042's `dependsOn` note — the accumulated rationale this gate asks whether to keep or restructure
  - Docs/tickets/in-progress/T-052-fix-mcp-test-db-truncation-env-timing.md — the live bug this topology already produced

Open question: Keep the current two-database hybrid — `questlog_test` shared by `packages/core` and `apps/server`, made safe only by `turbo.json`'s `test: { dependsOn: ["^test"] }` ordering; `questlog_test_mcp` exclusively for `packages/mcp`, run unordered/concurrent because it has no dependency edge to the others — or give every DB-touching package its own physical test database unconditionally and delete the `dependsOn` ordering entirely, so no package's test correctness depends on another package's task finishing first? The truncate-vs-transaction isolation strategy itself is not in question (already decided, T-027) — only whether "shared DB + enforced ordering" or "always-separate DB + no ordering" is the right topology as more DB-touching packages get added over time.

Second axis added 2026-07-29 (during `T-069`'s ticket-writing session):
  the question above weighs one axis only — how many physical databases
  *per package*. Concurrency adds a second, orthogonal one: how many *per
  concurrently-running agent*. `T-069` makes it normal for several
  executor sessions to run at once in separate worktrees, and they all
  currently resolve to the same physical `questlog_test`, whose
  `global-setup.ts` truncates every table repo-wide. One agent's test run
  therefore wipes another agent's fixtures mid-assertion — a failure that
  surfaces as an unrelated-looking assertion error, burns the victim's
  iteration cap on a phantom, and can trip the Blocked Protocol on a
  ticket that was never actually broken. So the real topology question is
  a matrix (package × worktree), not a list, and resolving this gate
  should settle both axes together rather than answering per-package now
  and rediscovering per-worktree later. Note the two axes have different
  reach: per-package affects CI too, whereas per-worktree is purely local
  — CI gets a fresh, isolated Postgres service container per run and has
  no cross-agent collision by construction. Also unresolved either way: a
  per-worktree database needs a real lifecycle (`CREATE DATABASE` *and*
  `db:migrate` before first use — `global-setup.ts` truncates but never
  migrates — plus reaping, or orphaned databases accumulate one per
  ticket forever). `T-069` explicitly scopes all of this out and carries
  no `Gated on:` line of its own, because none of its own three scope
  items touch the test-database layer; this note exists so the DB half
  isn't silently dropped.

Blocks: none yet — resolution changes provisioning in four places (`scripts/test-db-names.sh`, `.github/workflows/ci.yml`, `.github/workflows/e2e-release-check.yml`, `.claude/hooks/session-start.sh`) and the `env.DATABASE_URL` value in whichever vitest configs change database; it also determines the target shape T-052 (in-progress) should land in, and the shape any future vitest-config-factory cleanup should assume.

Notes: The ordering half of the current hybrid is a coordination dependency, and it has already broken once: `packages/core`'s test run is documented (`apps/server/vitest.config.ts`'s own comment) as needing to finish first so it "truncates+leaves the tables in the state this run expects" — an implicit contract between two packages' test tasks, not an isolated one. T-052 (in progress) is a live instance of the adjacent failure mode: an env-application-timing bug in the *shared* `global-setup.ts` truncation path caused `packages/mcp`'s suite to silently truncate the wrong physical database on every run. A uniform-DB-per-package design removes this whole class of dependency by construction — no package's test correctness would ever again depend on another package's execution order or on `global-setup.ts` correctly resolving which of several possible databases it's pointed at. The cost is mechanical, not architectural: one more physical database to provision at every layer (CI service container, `session-start.sh`, local `docker-compose`) per DB-touching package — already precedented by `questlog_test_mcp`'s existence, just generalized.

Third finding, surfaced while resolving this gate (2026-07-29): `turbo.json`'s `test:e2e` task carries **no `dependsOn` at all**, unlike `test`. `packages/core/vitest.e2e.config.ts` and `apps/server/vitest.e2e.config.ts` both point at `questlog_test` with no ordering between them — the identical T-026 race the default tier's `dependsOn` was added to prevent, just unfixed on this tier. It's silent today only because `packages/core` currently has zero e2e test files (`passWithNoTests: true`). The moment one is added, this reopens. Independent of this gate's resolution either way, and worth its own fix regardless of which topology wins — noted here because the per-package resolution below happens to close it as a side effect.

## Resolution (2026-07-29)

**Decided directly with Alex, this session — both axes, together, per the framing above.**

**Axis 1 (per-package vs. hybrid): uniform per-package physical databases.** `turbo.json`'s `test.dependsOn: ["^test"]` is deleted entirely. Reasoning: the current hybrid's safety depends on an implicit, easy-to-violate contract ("core's run must finish first and leave tables in the state server's run expects") that is documented in exactly one code comment and has already caused two real incidents (T-052's env-timing bug; the just-surfaced, still-live `test:e2e` race noted above, which per-package DBs close as a side effect without a separate fix). Isolated-DB-per-test-process is the standard, boring choice; a bespoke build-graph ordering contract standing in for it is the nonstandard one, and it gets more fragile as more DB-touching packages are added, not less.

Alex raised, correctly, whether 4 named databases instead of 2 is sprawl rather than simplification — worth recording explicitly since the answer is conditional, not a flat yes. **It is simplification only if CI provisioning is written as a loop over `scripts/test-db-names.sh`'s array (the pattern `.claude/hooks/session-start.sh` already uses), not as a copy-paste of `ci.yml`'s existing hardcoded "create and migrate `questlog_test_mcp`" step for each new database.** The naive copy-paste path is real, avoidable sprawl — `CLAUDE.md`'s "extract on the second occurrence, not the fifth" applies directly, and that MCP step was already the second occurrence, never extracted. Ticketed below with the loop as an explicit exit condition, not left to implementation's discretion.

**Axis 2 (per-worktree, added 2026-07-29): one Postgres instance per worktree, not one shared instance with per-worktree database names.** Each worktree runs its own `docker compose` stack on its own port; physical database *names* never change (`questlog_test`, `questlog_test_core`, etc. stay fixed regardless of which worktree runs them). This sidesteps the per-worktree lifecycle problem entirely — no dynamic `CREATE DATABASE`/`db:migrate`-on-first-use bookkeeping, no orphaned-database reaper to build. Reaping a finished worktree's test data is `docker compose down` on its own stack, already a normal git-worktree-adjacent operation. The port is already a single named constant in `test-db-url.ts` (`PORT = 5433`), so this is one env-driven override point, not a call-site-by-call-site rename. CI is untouched either way — GitHub Actions gives every run its own isolated service container by construction, so this axis is purely local.

Both axes are settled together per the framing note above, rather than answering axis 1 now and rediscovering axis 2 later.

Pointer added to `Docs/IMPLEMENTATION_NOTES.md` (this file is the resolution's full rationale; the pointer is one line, per `CLAUDE.md`'s "WHY only, once").
