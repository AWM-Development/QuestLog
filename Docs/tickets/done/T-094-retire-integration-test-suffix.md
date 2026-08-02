# T-094 — Retire the `.integration.test.ts` naming tier

Milestone ref: none — pipeline/tooling hygiene, same category as T-027/T-043/
T-093, not tied to a milestone checkbox. Resolves G-009
(`Docs/tickets/gated/resolved/G-009-integration-test-suffix-retire-or-enforce.md`).

Branch: gates/g-009-integration-test-suffix-retire-or-enforce

Context files (load ONLY these):
  - .claude/rules/backend.md §"Test DB pattern" and §"Mocking external HTTP"
  - .claude/skills/tdd-loop/SKILL.md (test conventions section)
  - Docs/DEVELOPMENT_GUIDE.md (Testing Layers table + Test File Convention section)
  - Docs/IMPLEMENTATION_NOTES.md (T-032 note header referencing the renamed file)
  - apps/server/scripts/smoke-test-dev.ts (comment referencing old filename)
  - apps/server/src/search.e2e.test.ts (header comment referencing old filename)
  - Docs/tickets/backlog/T-091-mcp-oauth-resource-audience-binding.md,
    Docs/tickets/queue/T-064-mcp-tool-description-content-relocation.md
    (Context files referencing old filenames)
  - Docs/tickets/gated/resolved/G-009-integration-test-suffix-retire-or-enforce.md
    (the resolution and full rationale — do not re-litigate the decision,
    just implement it)

Mockup: none

Model: sonnet

Scope:
  Rename all `*.integration.test.ts` files to plain `*.test.ts` (13 files:
  7 under `apps/server/src/routers`+`routes`, 4 under
  `packages/core/src/db/schema`, matching the gate's own count). Update
  every living-doc reference to the retired suffix (`.claude/rules/backend.md`,
  `.claude/skills/tdd-loop/SKILL.md`, `Docs/DEVELOPMENT_GUIDE.md`) to state
  plainly that unit and integration tests share one `*.test.ts` suffix, and
  that the only naming split vitest configs actually enforce is
  `*.e2e.test.ts`. Fix the durable file-locator reference in
  `Docs/IMPLEMENTATION_NOTES.md`'s T-032 section header, the two source
  comments referencing old filenames (`smoke-test-dev.ts`,
  `search.e2e.test.ts`), and the two not-yet-executed tickets
  (`T-091` backlog, `T-064` queue) whose Context files named old filenames.

Out of scope:
  - Adding a vitest `include`/`exclude` split or a lint/CI rule restricting
    `createTestDb()` callers — that was the rejected alternative (see the
    gate's resolution).
  - Rewriting purely historical narrative in `IMPLEMENTATION_NOTES.md` that
    references old filenames in past-tense incident descriptions (e.g. the
    T-042 split note, the T-031 truncation note) — those describe what
    happened at the time, not a current-state convention; left untouched
    per "WHY only, once," not chased down wholesale.
  - `CHANGELOG.md`, `Docs/tickets/reports/`, `Docs/tickets/gated/`,
    `Docs/IMPLEMENTATION_NOTES_ARCHIVE.md`, `Docs/AUDIT_*.md`,
    `Docs/milestones/MILESTONES_V2.md` — frozen historical/archival records,
    never edited retroactively.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean, build clean — pasted
    output for `pnpm typecheck`, `pnpm build`, `pnpm lint`, `pnpm test`
  - `find . -name "*.integration.test.ts" -not -path "*/node_modules/*"`
    returns nothing
  - `grep -rn "integration\.test\.ts"` across non-historical files (docs,
    rules, skills, source comments, active tickets) returns only the
    intentional "there is no `.integration.test.ts` suffix" explanatory
    lines, not stale file-path references

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: no milestone checkbox to flip (see Milestone
  ref above), `IMPLEMENTATION_NOTES.md` updated per Scope above, a
  `CHANGELOG.md` entry under `[Unreleased]` (tooling/dev-experience
  section), morning report written.
