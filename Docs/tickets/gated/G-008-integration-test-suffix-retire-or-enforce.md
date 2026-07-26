# G-008 — Retire or enforce the `.integration.test.ts` naming tier

Gate type: 🧠 strategy

Milestone ref: none — pipeline/tooling hygiene; surfaced by the same 2026-07-26 audit as G-006/G-007

Opened: 2026-07-26 — by Alex/agent during the same standalone test-infrastructure audit

Context files (load ONLY these):
  - .claude/rules/backend.md §"Test DB pattern" and §"Mocking external HTTP" (the only place test-tier conventions are documented; neither mentions the `.integration.test.ts` suffix)
  - apps/server/src/routers/campaign.integration.test.ts, apps/server/src/routers/session.integration.test.ts (representative `.integration.test.ts` files — full list via `find . -name "*.integration.test.ts" -not -path "*/node_modules/*"`, ~13 files)
  - packages/core/src/services/campaign.service.test.ts, packages/core/src/services/session.service.test.ts (representative plain `.test.ts` files that also call `createTestDb()` and hit the real database — same behavior as the `.integration` files above, different suffix)
  - packages/core/vitest.config.ts, apps/server/vitest.config.ts, packages/mcp/vitest.config.ts (confirm: none has an `include`/`exclude` pattern referencing `.integration.` specifically — every DB-touching test file, regardless of suffix, runs in the same default tier via the shared `**/*.test.ts` match)

Open question: No vitest config anywhere globs on `.integration.test.ts` specifically — those ~13 files run in the default tier for the same reason plain `.test.ts` files do (matching `**/*.test.ts`), and several plain-suffix files in `packages/core/src/services/` exercise the real database identically to the `.integration`-suffixed ones. The suffix currently signals nothing a config or a contributor can rely on. Should it be retired (rename all `.integration.test.ts` files to plain `.test.ts`, since the two-tier split that actually matters is default-vs-`.e2e.` only) — or given real enforcement (e.g. a vitest `include`/`exclude` split so unit vs. integration genuinely differ in what runs when, or a lint/CI rule restricting which files may call `createTestDb()`)?

Blocks: none yet — resolution is either a mechanical rename pass (~13 files) or a small config/lint addition, plus a one-line correction to `.claude/rules/backend.md`'s "Test DB pattern" section, which currently doesn't mention the suffix distinction at all in either direction.

Notes: Lowest-stakes of the three test-infra gates filed from this audit (G-006, G-007, this one) — bundled together because they surfaced in the same session and Alex may want to decide all three at once, but each `Blocks:` is self-contained and `/ungate` can resolve them independently in any order.
