# T-145 — Directory/file organization audit & architecture documentation

**Goal, stated plainly (this is what the exit condition is actually
checking, more than any individual finding below):** Alex should be able
to navigate this repo quickly by instinct — "where would X live" should
have an obvious answer — without cross-referencing tickets or asking an
agent. Months of AI-driven development have produced the usual side
effect: directories and files that grew by accretion (one more file added
to whatever directory was already open) rather than by deliberate
placement. This ticket is a deliberate stop to nip that before it
compounds further, not a cosmetic pass.

Companion in spirit to `T-132-bootstrap-drift-audit.md` (merged, PR #214)
but a distinct concern: T-132's dimension 3 ("dead/deprecated code")
checked for orphaned exports and dead routes — code-level debt — not
directory/file layout or the absence of any architecture documentation.
Neither of those was in T-132's 7 dimensions, and no `Docs/ARCHITECTURE.md`
or equivalent exists anywhere in the repo today (confirmed by a full-repo
`find -iname "*architecture*"` at draft time — the only hits are the T-017/
T-132 ticket filenames themselves). Born from an interactive planning
session with Alex, 2026-08-07, immediately following T-132/T-133's own
drift-audit work.

**Pre-scan already turned up three concrete, real findings** (not
hypotheticals — grounding this ticket's Scope rather than leaving it
abstract):
  1. **CI logic mislocated:** `packages/core/src/ci/` (`gate-guard.ts`,
     `scope-guard.ts` + their `.test.ts` files) sits inside a domain
     package's `src/`, alongside `services/`, `db/`, `observability/`.
     It's real, unit-tested CI-guard logic invoked via
     `scripts/ci-gate-guard.sh`/`ci-scope-guard.sh` wrappers from
     `.github/workflows/ci.yml` — correctly *not* pure YAML — but its
     location inside `packages/core` reads as domain logic and hides it
     from anyone scanning for "how does CI work here." A dedicated
     `packages/ci/` (or `packages/core/src/ci/` promoted to its own
     workspace package) is a plausible fix; confirm during the session
     rather than assuming.
  2. **A file already flagged for splitting has its own ticket:**
     `packages/mcp/src/server.test.ts` is 2,916 lines — effectively the
     entire `packages/mcp/src/tools/` directory's tests smashed into one
     file. Already ticketed as `T-103-split-mcp-server-test-file.md`
     (`Docs/tickets/queue/`) — don't re-solve it here, just confirm T-103's
     scope still matches this audit's own splitting criteria (below) and
     cross-reference it from the audit's findings rather than duplicating.
  3. **Flat, ungrouped directories at file-count extremes:**
     `packages/core/src/services/` (33 files, no subgrouping),
     `Docs/tickets/reports/` (100), `Docs/tickets/done/` (98). The
     `Docs/tickets/*` cases may be legitimate append-only historical logs
     (not code a human navigates by directory structure the same way) —
     judge each on its own terms rather than applying one flat rule to
     both code and docs-archive directories.

**⚠️ NOT ELIGIBLE FOR AUTONOMOUS NIGHTLY EXECUTION.** Being run right now,
interactively, with Alex present, in this same session — same category as
T-132 (`Docs/tickets/queue/T-132-bootstrap-drift-audit.md` before it
merged): judging what counts as organizational sprawl vs. intentional
structure, and what belongs in an architecture doc, needs Alex's own
institutional context, not a narrow-context nightly pass. Carries no
`Blocked on:`/`Gated on:` field for the same reason T-132 carried
neither — this ticket simply isn't a shape the executor's pre-flight
scans for.

Milestone ref: cross-cutting audit + documentation (ad hoc — not extracted
  from a milestone doc task, same as T-132/T-133)

Complexity tier: L

Strategy-gate flag: no

Priority: P0 (confirmed by Alex at draft time)

Branch: chore/m-audit/t-145-file-org-architecture-docs-audit

Context files (load ONLY these to start — same relaxed convention T-132
used, and for the same reason: a narrow file list would defeat an audit
whose whole point is noticing structure. The agent running this should
read the repo tree broadly, not just these):
  - Docs/tickets/reports/T-132-bootstrap-drift-audit.md (what's already
    covered — don't re-litigate its findings or re-run its 7 dimensions)
  - Docs/tickets/queue/T-135-anthropic-llm-service-test-mocking-convention.md,
    Docs/tickets/queue/T-136-dead-code-detection-tooling.md,
    Docs/tickets/queue/T-137-v2-deferred-table-re-audit.md (T-132's filed
    follow-ups — confirm none overlap before filing anything new here)
  - Docs/tickets/queue/T-103-split-mcp-server-test-file.md (the
    already-ticketed oversized-file case — confirm it still matches this
    audit's splitting heuristic rather than re-solving it)
  - packages/core/src/ci/gate-guard.ts, packages/core/src/ci/scope-guard.ts,
    packages/core/package.json (the `ci-gate-guard`/`ci-scope-guard`
    script entries), .github/workflows/ci.yml (the `gate-guard`/
    `scope-guard` jobs that invoke them via `scripts/ci-*.sh`) — full
    context for the pre-scan's CI-mislocation finding
  - CLAUDE.md
  - .claude/rules/*.md
  - Top-level repo tree: apps/*, packages/*, Docs/*, scripts/*,
    .github/workflows/*, .claude/* (directory listing first, then read
    into whichever subtrees look questionable — this ticket is explicitly
    about the *shape* of the tree, not deep code review of any one file)
  - Docs/milestones/MILESTONES_V1_MCP.md's "Deferred to v2" section (so
    intentionally-frozen v2 surfaces aren't mistaken for sprawl)

Mockup: none

Model: sonnet (interactive session — Alex is present throughout; this
  field just fixes which model executes any edits made)

Scope:
  1. **Directory/file organization audit**, applying concrete heuristics
     rather than vibes — walk the repo's directory structure end-to-end
     (not a single-file linter pass):
     - **File-count sprawl:** any *source-code* directory (not a docs
       archive or generated-artifact directory) holding 15+ files with no
       subgrouping is a candidate for splitting into subdirectories by
       responsibility. Judge docs/archive directories (`Docs/tickets/done/`,
       `Docs/tickets/reports/`, etc.) separately — flag only if their flat
       shape is actually hurting lookup (e.g. no index/dated grouping),
       not merely because the count is high.
     - **Oversized files:** any single source file over ~400 lines
       (test files: ~500, given fixture/setup overhead) is a candidate
       for splitting along natural seams. Cross-reference T-103 for the
       one already-ticketed case; don't duplicate it.
     - **Misplaced/mislocated logic:** code living in a directory whose
       name or sibling contents don't match its actual role — start from
       the `packages/core/src/ci/` finding above, then scan the rest of
       the tree for the same class of problem (a CI-only concern in an
       app package, a script-only concern in a service directory, etc.).
     - **Duplicated structure** — near-identical directory shapes across
       packages that should share a convention or don't need to differ.
     - **Naming drift** — inconsistent casing/pluralization/abbreviation
       conventions for same-role directories or files across packages.
     - Anything under `tmp/worktrees/` or similar that's tracked in git
       but shouldn't be (cross-check against T-126's scope if that
       ticket has landed by the time this runs — don't duplicate its
       gitignored-artifact reporting).
     For each finding: fix trivial ones inline (a rename, a move, an
     update to the one or two import paths it touches) in this session's
     branch. File anything requiring a broader refactor (e.g. actually
     splitting `packages/core/src/ci/` into its own package, or breaking
     up `entity.service.ts`) as a new ticket in `Docs/tickets/backlog/`
     (never straight to `queue/`) — same supersession/filing discipline
     T-132 used.
  2. **File-organization documentation — the primary deliverable.**
     Produce `Docs/ARCHITECTURE.md`, written as a repo-navigation guide
     first and a system-architecture reference second, since navigability
     is this ticket's actual goal:
     - **A repo map**: every top-level directory (`apps/*`, `packages/*`,
       `Docs/*`, `scripts/*`, `.github/`, `.claude/`) with a one-line "what
       lives here" and, for the larger ones, a second level down.
     - **Placement rules**: for the recurring "where does new code go"
       decisions — a new MCP tool, a new service, a new shared type, a new
       CI check, a new script — name the directory it belongs in and why,
       so the next addition doesn't have to rediscover the convention by
       reading five existing examples.
     - **The file-count/file-size heuristics used in this audit** (from
       Scope item 1 above), written down as an ongoing convention, not
       just this session's one-time judgment call — so a future session
       (agent or Alex) has the same bar to check new code against.
     - A short system-architecture section: request/data flow for the MCP
       surface (MCP tool → router → service → Drizzle, per
       `.claude/rules/backend.md`), how pgvector-backed lore search fits
       in, and the v1 MCP-first pivot ("why this shape" — cite
       `MILESTONES_V1_MCP.md`'s own framing rather than re-deriving it).
       Keep this section short — link to `.claude/rules/*.md` and
       `Docs/DEVELOPMENT_GUIDE.md` for convention-level detail rather than
       duplicating it; this doc's job is orientation, not an exhaustive
       API reference.
  3. Add a pointer to `Docs/ARCHITECTURE.md` from `CLAUDE.md`'s pointer
     map, so future sessions discover it the same way they discover
     `Docs/DEVELOPMENT_GUIDE.md`.

Out of scope:
  - Re-running T-132's 7 audit dimensions (pattern consistency, rules-file
    accuracy, dead code, `IMPLEMENTATION_NOTES.md` hygiene, ticket-pipeline
    health, test hygiene, schema hygiene) — those are covered ground.
  - Gitignored build-artifact/cache hygiene (`.turbo/`, `dist/`, stale
    `tmp/worktrees/` entries) — that's T-126's scope, not this ticket's,
    even though both touch the file tree.
  - Any non-trivial refactor beyond a same-session rename/move — file it
    as a backlog ticket instead, same discipline T-132 used.
  - Re-opening any decision `MILESTONES_V1_MCP.md`'s "Deferred to v2"
    section already closed (e.g. flagging a frozen v2 surface as
    "misplaced" — it's intentionally untouched, not sprawl).
  - Building any tooling/command to re-run this audit later — unlike
    T-132→T-133, this ticket doesn't need a recurring companion; the
    output (a clean tree + a living `ARCHITECTURE.md`) is the durable
    artifact, not a repeatable report.

Exit condition (human-checkable — this ticket is audit-and-documentation
shaped, not pure-code-shaped, so "tests pass" alone doesn't cover it):
  - `Docs/ARCHITECTURE.md` exists, covers all four bullet points in Scope
    item 2 (repo map, placement rules, the file-count/size heuristics as
    a stated convention, and the short system-architecture section), and
    is linked from `CLAUDE.md`'s pointer map.
  - All three pre-scan findings above are explicitly resolved in the
    audit output: `packages/core/src/ci/`'s placement decided (moved, or
    explicitly kept with a stated reason) and either fixed inline or
    filed to `backlog/`; T-103 confirmed still correctly scoped against
    this audit's own splitting heuristic (or a note explaining any gap);
    the three flat-directory cases each given an explicit verdict
    (split / leave-as-is-and-why).
  - Every other organizational finding turned up during the full walk is
    either fixed inline in this branch (small, reviewable diff) or filed
    as a ticket in `Docs/tickets/backlog/`, linked from a
    `Docs/tickets/reports/T-145-file-org-architecture-docs-audit.md`
    report.
  - Applying this ticket's own file-count/size heuristics to the
    post-fix repo tree turns up no source-code directory at 15+
    ungrouped files and no un-filed source file over ~400/~500 lines
    (test files) that the report didn't already address — i.e. the audit
    actually acted on its own bar, not just documented it.
  - all tests green, typecheck clean, lint clean (any inline
    rename/move must not break imports or CI)
  - Alex has reviewed and signed off before this branch is merged.

Iteration cap: not applicable (interactive session, not autonomous
  execution — no Blocked Protocol needed)

Definition of done includes: IMPLEMENTATION_NOTES.md updated if any
  non-obvious decision was made during the audit, a CHANGELOG.md entry
  under [Unreleased] only if a trivial inline fix changed shipped
  behavior, no milestone-doc checkbox to flip (ad hoc ticket, not
  extracted from a milestone task).
