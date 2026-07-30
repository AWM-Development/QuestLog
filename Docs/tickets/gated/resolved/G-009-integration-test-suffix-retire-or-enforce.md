# G-009 — Retire or enforce the `.integration.test.ts` naming tier

Gate type: 🧠 strategy

Milestone ref: none — pipeline/tooling hygiene; surfaced by the same 2026-07-26 audit as G-007/G-008

Opened: 2026-07-26 — by Alex/agent during the same standalone test-infrastructure audit

Context files (load ONLY these):
  - .claude/rules/backend.md §"Test DB pattern" and §"Mocking external HTTP" (the only place test-tier conventions are documented; neither mentions the `.integration.test.ts` suffix)
  - apps/server/src/routers/campaign.integration.test.ts, apps/server/src/routers/session.integration.test.ts (representative `.integration.test.ts` files — full list via `find . -name "*.integration.test.ts" -not -path "*/node_modules/*"`, ~13 files)
  - packages/core/src/services/campaign.service.test.ts, packages/core/src/services/session.service.test.ts (representative plain `.test.ts` files that also call `createTestDb()` and hit the real database — same behavior as the `.integration` files above, different suffix)
  - packages/core/vitest.config.ts, apps/server/vitest.config.ts, packages/mcp/vitest.config.ts (confirm: none has an `include`/`exclude` pattern referencing `.integration.` specifically — every DB-touching test file, regardless of suffix, runs in the same default tier via the shared `**/*.test.ts` match)

Open question: No vitest config anywhere globs on `.integration.test.ts` specifically — those ~13 files run in the default tier for the same reason plain `.test.ts` files do (matching `**/*.test.ts`), and several plain-suffix files in `packages/core/src/services/` exercise the real database identically to the `.integration`-suffixed ones. The suffix currently signals nothing a config or a contributor can rely on. Should it be retired (rename all `.integration.test.ts` files to plain `.test.ts`, since the two-tier split that actually matters is default-vs-`.e2e.` only) — or given real enforcement (e.g. a vitest `include`/`exclude` split so unit vs. integration genuinely differ in what runs when, or a lint/CI rule restricting which files may call `createTestDb()`)?

Blocks: none yet — resolution is either a mechanical rename pass (~13 files) or a small config/lint addition, plus a one-line correction to `.claude/rules/backend.md`'s "Test DB pattern" section, which currently doesn't mention the suffix distinction at all in either direction.

Notes: Lowest-stakes of the three test-infra gates filed from this audit (G-007, G-008, this one) — bundled together because they surfaced in the same session and Alex may want to decide all three at once, but each `Blocks:` is self-contained and `/ungate` can resolve them independently in any order.

**Cross-reference, added 2026-07-29 (context for whoever runs `/ungate` on this next):** `G-008` has since resolved (`Docs/tickets/gated/resolved/G-008-test-database-topology-uniform-vs-hybrid.md`), and its implementation ticket `T-071` (`M-PIPELINE`, `MILESTONES_V1_1_MCP.md`) edits the exact three vitest configs listed in this gate's Context files above (`packages/core/vitest.config.ts`, `apps/server/vitest.config.ts`, `packages/mcp/vitest.config.ts`) — but only each file's `env.DATABASE_URL` value, never `include`/`exclude`. **No overlap with this gate's actual question** (whether to add an `include`/`exclude` split keyed on the `.integration.` suffix, or retire the suffix instead) — flagged only so recent, unrelated edits to these same three files don't read as already having touched the ground this gate is about. This gate remains fully open and is **not** answered or archivable by `T-071` — confirm at resolution time that `T-071` has actually merged by then, since a second, unrelated diff to the same three files in the interim is exactly the kind of git-history noise this note exists to explain away in advance.

## Resolution (2026-07-30)

**Decision: retire the suffix.** All 13 `.integration.test.ts` files renamed to plain `.test.ts`. Confirmed at resolution time: no vitest config anywhere globs on `.integration.` specifically (the premise the gate opened with still held — `T-071` only ever touched `env.DATABASE_URL`, never `include`/`exclude`, per the cross-reference note above), and enforcing the suffix would have added config/lint surface to preserve a naming signal ("touches the DB") that's already true of most of this codebase's tests by default, not a meaningful minority worth calling out separately from `.e2e.test.ts`.

Alex directed this be implemented immediately in the same session rather than drafted into `queue/`/`backlog/` for the nightly executor, given the small size (mechanical rename + doc corrections). Landed as ticket `T-094` (`Docs/tickets/done/T-094-retire-integration-test-suffix.md`, report at `Docs/tickets/reports/T-094-retire-integration-test-suffix.md`), directly in `done/` rather than routed through the normal `queue/` → `in-progress/` → `done/` pipeline.

`Blocks:` named "none yet" — no downstream ticket or milestone task carried a `Gated on: G-009` reference to clear.
