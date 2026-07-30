# T-042 — Split `apps/server`'s domain layer into `packages/core` + `packages/mcp`, rename `apps/mcp` → `apps/mcp-stdio`

Milestone ref: M-REMOTE.1 (`Docs/MILESTONES_V1_1_MCP.md`) — repo-organization
follow-up to T-028, found during a morning-review session walking the repo
tree with Alex; not itself a milestone task, but unblocks M-REMOTE.2/
M-REMOTE.3 the way T-028 itself was meant to (same precedent as T-025/T-027/
T-041).

Branch: refactor/repo-org/t-042-split-domain-mcp-packages

Context files (load ONLY these):
  - apps/server/src/{db,services,lib}/** (everything moving to packages/core)
  - apps/server/src/mcp/** (everything moving to packages/mcp — this is
    T-028's own output; T-028's ticket/report describe why it's shaped the
    way it is)
  - apps/server/src/{routers,server.ts,trpc.ts,main.ts,process-imports.ts}
    (what stays in apps/server; gets import rewrites only)
  - apps/server/{package.json,tsconfig.json,drizzle.config.ts,vitest.config.ts,vitest.e2e.config.ts,scripts/build.mjs,Dockerfile}
  - apps/mcp/** (the whole app — rename target)
  - apps/mcp/{package.json,tsconfig.json,vitest.config.ts,vitest.e2e.config.ts,scripts/build.mjs}
  - packages/shared/{package.json,tsconfig.json} (the pattern to mirror for
    the two new packages' package.json `exports` / tsconfig `composite`
    shape)
  - turbo.json, pnpm-workspace.yaml, fly.dev.toml, fly.prod.toml
  - .claude/rules/{backend.md,mcp.md,db.md} and their .cursor/rules/*.mdc
    mirrors
  - CLAUDE.md, README.md, Docs/DEVELOPMENT_GUIDE.md (the specific sections
    named in Scope below — not a full read)
  - Docs/tickets/{backlog,queue}/{T-017,T-029,T-030,T-031,T-032,T-033,T-034,T-038,T-039}*.md
    (only their `Context files:` sections need touching)

Mockup: none

Model: sonnet

Scope:
  `apps/server/src/{db,services,lib}` — the domain layer — is currently
  private to the `apps/server` app. T-028 needed MCP tool logic to reach
  those services without creating a circular TypeScript project reference,
  and the only available fix at the time was moving the tool-registration
  layer *into* `apps/server` (`apps/server/src/mcp/`). That's functionally
  correct but leaves two directories named `mcp` at different tree depths,
  and `apps/*` no longer cleanly means "one directory per deployable" the
  way `apps/server`/`apps/web` do.

  Pull the domain layer into a new package, `packages/core`
  (`@questlog/core`) — `db/`, `services/`, `lib/` moved wholesale via `git
  mv`, each moved file's relative imports (`./db/...`, `./services/...`)
  staying relative to their new location, and anything in `apps/server`
  that imported them rewritten to `@questlog/core/...`. Pull `apps/server/
  src/mcp/**` into a second new package, `packages/mcp` (`@questlog/mcp`)
  — this frees the `@questlog/mcp` package name, so rename the app
  `apps/mcp` → `apps/mcp-stdio` (`@questlog/mcp-stdio`) at the same time;
  it's purely a thin stdio-transport binary post-T-028, and the rename
  makes that legible from the tree instead of colliding names with the new
  package. `packages/mcp`'s tools import `@questlog/core/services/...`
  instead of relative `../../services/...`.

  `apps/server` keeps `routers/`, `server.ts`, `trpc.ts`, `main.ts`,
  `process-imports.ts`, and its own router/server integration tests,
  rewritten to import from `@questlog/core/...`. It also keeps operating
  the `db:migrate`/`db:generate`/`db:push`/`db:studio` scripts as *its own*
  package.json scripts even though the files they invoke now live in
  `packages/core` — point each script body at the relocated file via a
  relative path out of the package (`"db:migrate": "tsx
  ../../packages/core/src/db/migrate.ts"`, same pattern `apps/mcp`'s
  existing `vitest.config.ts` already uses for reaching a sibling
  package's `globalSetup`). This is deliberate: it keeps `pnpm --filter
  @questlog/server db:migrate` — and by extension every doc, CI workflow,
  and Fly config that names it — unchanged. Do not rename or relocate
  these scripts to `packages/core`; that would cascade into CI/README/
  CLAUDE.md/DEPLOY-doc edits this ticket is specifically designed to avoid
  needing.

  New packages follow `packages/shared`'s existing pattern: `package.json`
  with `exports: {".": "./src/index.ts", "./*": "./src/*.ts"}` (the
  wildcard subpath pattern `apps/mcp`'s tsconfig currently hacks in ad hoc
  via a raw path mapping into `apps/server/src/*` — declare it properly on
  the producing package instead), `tsconfig.json` with `composite: true`
  mirroring `apps/server`'s current shape, referenced via TS project
  references from every consumer. Dependencies for each new
  `package.json` are whatever the moved files actually import — reconcile
  by grep, don't guess (e.g. `drizzle-orm`/`postgres` almost certainly move
  to `packages/core`; `@modelcontextprotocol/sdk` moves to `packages/mcp`;
  check whether `apps/server` still needs any of them directly for the
  `Database` type import in `server.ts`/`trpc.ts`).

  **Test database race, not just a cosmetic reorg concern:** today every
  DB-touching test in `apps/server` (db, services, routers) runs as one
  vitest process against `questlog_test`, sequentially — safe by
  construction. After the split, `packages/core`'s tests and `apps/server`'s
  tests become two separate turbo tasks with no ordering between them by
  default (confirmed: this is exactly why `apps/mcp` needed its own
  physical database, `questlog_test_mcp`, per T-026 — turbo does not order
  sibling `test` tasks by the package dependency graph today, only `build`
  has a `dependsOn`). Add `"test": { "dependsOn": ["^test"] }` to
  `turbo.json` (mirrors the existing `build` task) so `packages/core`'s
  tests always finish before any consumer's start. This avoids needing a
  third physical test database and avoids touching `ci.yml`/
  `e2e-release-check.yml`/`session-start.sh`'s existing 3-way-duplicated
  `questlog_test_mcp` provisioning list — do not add a new database name as
  an alternative fix; the `dependsOn` change is the intended solution.
  `packages/mcp` keeps `questlog_test_mcp` unchanged (no dependency edge to
  `apps/server`, so it can still run concurrently against a different
  physical DB, same as today).

  **`apps/server/Dockerfile` needs updating, not just typechecked around:**
  its `deps` and `prod-deps` stages `COPY` specific `package.json` files by
  path before `pnpm install --filter ...` — add `packages/core/package.json`
  and `packages/mcp/package.json` to both stages' COPY lists, and update
  the `apps/mcp/package.json` line to `apps/mcp-stdio/package.json`. The
  migrations `COPY` (currently `/repo/apps/server/src/db/migrations` →
  `./apps/server/src/db/migrations`) must change its *source* to
  `/repo/packages/core/src/db/migrations`, keeping the destination
  unchanged (`migrate.ts`'s `migrationsFolder` path resolves against
  `process.cwd()` at `/repo/apps/server`, per the Dockerfile's own `WORKDIR`
  and its comment on that line — not against the moved file's own
  location). Update `apps/server/scripts/build.mjs`'s second `entryPoints`
  value to `../../packages/core/src/db/migrate.ts` (bundled output stays
  `dist/db/migrate.js`, so Fly's `release_command` in both `fly.dev.toml`
  and `fly.prod.toml` needs no change). Update
  `apps/server/drizzle.config.ts`'s `schema`/`out` paths to point into
  `packages/core`; leave the file itself at its current path so `pnpm
  --filter @questlog/server db:generate` keeps working unchanged.

  Documentation:
  - `CLAUDE.md`'s intro paragraph and `README.md`'s `## Architecture` tree
    (lines 13-22) get the new packages named and `apps/mcp` renamed.
    (README doesn't mention MCP at all today — pre-existing staleness, not
    this ticket's job to fix beyond what the tree diagram needs.)
  - `Docs/DEVELOPMENT_GUIDE.md` line ~506's `apps/server/src/db` reference.
  - `Docs/IMPLEMENTATION_NOTES.md`: new dated entry explaining the split,
    the `turbo.json` `dependsOn` fix and why (not a new test DB), and the
    Dockerfile change — mirror T-028's own entry's level of detail.
  - `CHANGELOG.md`: new `[Unreleased]` entry.
  - `.claude/rules/backend.md`: broaden frontmatter `paths:` to
    `["apps/server/**", "packages/core/**"]` — its content
    (router→service→Drizzle, Zod conventions, test DB pattern, external-API
    mocking) genuinely covers both now; don't split the file, its content
    doesn't partition cleanly by directory.
  - `.claude/rules/mcp.md`: retarget `paths:` to `["apps/mcp-stdio/**",
    "packages/mcp/**"]`.
  - `.claude/rules/db.md`: already globs `**/db/**`, no change needed.
  - Mirror both frontmatter changes into `.cursor/rules/backend.mdc` and
    `.cursor/rules/mcp.mdc` per the existing documented convention in each
    `.claude/rules/*.md` file's HTML comment ("Mirrored to
    .cursor/rules/*.mdc — edit here first, then copy the body... over").
    Do not touch `mcp.mdc`'s body content beyond the frontmatter — a
    separate, already-flagged content drift (G-001's rewrite never got
    mirrored) is out of scope here.
  - Update `Context files:` path references in the not-yet-executed
    backlog/queue tickets listed above that name `apps/server/src/mcp`,
    `apps/server/src/services`, `apps/server/src/db`, or
    `apps/mcp/src/{tools,server}` — T-030 (mount-streamable-http-mcp-
    transport) matters most, since it's the ticket this reorg exists to
    unblock. Leave every ticket under `done/`, `archive/`, and `reports/`
    untouched — historical record of what was true when written.

Out of scope:
  - No behavior, schema, or tool-contract changes — pure reorganization,
    same spirit as T-028. If a service or tool's logic looks improvable
    while moving it, leave it.
  - No fix for `.cursor/rules/mcp.mdc`'s pre-existing G-001 content drift
    (frontmatter only, per above).
  - No fix for README.md's broader staleness (it doesn't mention the MCP
    surface as v1's primary interface at all) beyond the Architecture tree
    diagram update named above.
  - Do not introduce a new physical test database — the `turbo.json`
    `dependsOn` fix is the intended solution to the test-race problem
    described above.
  - No changes to `fly.dev.toml`/`fly.prod.toml` themselves — the
    Dockerfile/build.mjs changes are designed to keep `release_command =
    'node dist/db/migrate.js'` valid unchanged.

Exit condition (machine-checkable):
  - All tests green, typecheck clean, lint clean — pasted output, not a
    summary.
  - `packages/core` and `packages/mcp` each report a test count matching
    what moved (grep-verified `it(...)` counts before/after, same method
    T-028's report used for its own move).
  - `pnpm --filter @questlog/mcp-stdio build && pnpm --filter
    @questlog/mcp-stdio smoke` passes, reporting all 7 tools — proves the
    stdio binary still boots after two relocations instead of one.
  - `pnpm build` (turbo, all packages) succeeds.
  - `docker build -f apps/server/Dockerfile .` from the repo root succeeds
    (Fly isn't deployed on either environment yet, so this is the only real
    check available before an actual deploy — do not skip it because
    nothing is live).
  - `grep -rn "apps/server/src/mcp\|apps/server/src/services\|apps/mcp/src"`
    across the repo, excluding `Docs/tickets/{done,archive,reports}/`,
    returns nothing.
  - `apps/server/src/mcp/`, `apps/server/src/services/`,
    `apps/server/src/db/`, `apps/server/src/lib/`, and `apps/mcp/` (the old
    directory) no longer exist.

Iteration cap: 3 distinct approaches on any single failure, then Blocked
  Protocol

Definition of done includes: `Docs/IMPLEMENTATION_NOTES.md` updated per
  Scope above, `CHANGELOG.md` entry under `[Unreleased]`, morning report
  written. No milestone checkbox to flip (not itself a milestone task, see
  Milestone ref line above).
