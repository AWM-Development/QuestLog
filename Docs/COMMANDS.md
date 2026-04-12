# Repeatable Commands

Full procedure definitions for Claude Code slash commands. CLAUDE.md references this file — read it on-demand when executing a command. Overnight agents never need this file.

---

## `/morning-review` — Review Overnight Agent Work

When the user runs `/morning-review`, execute this procedure:

**Phase 1 — Assess.** Read `Docs/NEXT_TASK_PLAN.md` and check the status field. Note the milestone number (e.g., `M4.1`) and branch name.

- If status is `none` or `reviewed`: report "No overnight work to review" and stop.
- If status is `ready`: report "Plan was not picked up by the overnight agent" and stop.
- If status is `in-progress`: report incomplete work — proceed to Phase 2, note unfinished checkpoints.
- If status is `done`: proceed to Phase 2.

**Phase 2 — Review overnight work.**

1. Check out the feature branch listed in the plan metadata.
2. Read the Agent Report section of `Docs/milestones/M{X}/PLAN.md` for the summary, run log, and any issues.
3. Read `Docs/milestones/M{X}/REPORT.md` if it exists.
4. Run `git log develop..HEAD --oneline` to see all overnight commits.
5. Run `git diff develop...HEAD --stat` to see files changed.
6. Present a summary to the user:
   - Checkpoints completed vs skipped (and why)
   - Files changed (with line counts)
   - Any issues or gates the agent flagged
   - Test status: run `pnpm turbo test` and report results

**Phase 3 — Code review.** Run the code review protocol (§ Code Review Trigger in CLAUDE.md) on all files changed since `develop`. Fix Critical and High issues.

**Phase 4 — Doc updates.**
- Check off the task in MILESTONES
- Update IMPLEMENTATION_NOTES.md with any non-obvious decisions
- Update CHANGELOG.md under `[Unreleased]`
- Update PRD.md if implementation deviated from spec

**Phase 5 — Report.** Write/update the overnight report to `Docs/milestones/M{X}/REPORT.md` (get milestone number from plan metadata). Include:
- Milestone/task reference
- Checkpoints completed vs skipped
- Test results summary
- Code review findings and fixes applied
- Any issues or blockers

**Phase 6 — Wrap up.** After the user approves:
- Set `Docs/NEXT_TASK_PLAN.md` status to `reviewed`
- Commit all changes
- Ask the user if they want to merge the feature branch to `develop`
- If the milestone is fully complete, offer to archive: move `Docs/milestones/M{X}/` → `Docs/milestones-archive/M{X}/`

---

## `/style-audit` — Design Token Compliance Sweep

When the user asks for a "style audit", "styling consistency check", or similar, run this procedure:

**Phase 1 — Scan.** For every `.tsx` file under `apps/web/src`, check inline `style={{...}}` objects and top-level `CSSProperties` constants for:

1. **Hardcoded colors** — any raw `#hex`, `rgb(...)`, or `rgba(...)` that has an equivalent CSS variable in `apps/web/src/index.css` (e.g. `rgba(96,184,255,0.06)` → `var(--state-active-soft)`).
2. **Hardcoded spacing** — pixel values like `8px`, `12px`, `16px` that map to `var(--space-*)` tokens.
3. **Hardcoded border-radius** — numeric `borderRadius` values that should use `var(--r-sm)` / `var(--r-md)` / `var(--r-lg)` / `var(--r-xl)` / `var(--r-pill)`.
4. **Hardcoded shadows** — any `boxShadow` string that duplicates a `var(--shadow-*)` token.
5. **Copy-pasted style blocks** — the same style object (or near-duplicate) appearing in 2+ files, which should be extracted to `apps/web/src/components/styles.ts` or a feature-level `styles.ts`.
6. **Inconsistent sizing** — icon buttons, chip elements, or similar components using different dimensions without reason.

**Phase 2 — Report.** Present findings in a table grouped by severity (HIGH / MEDIUM / LOW):
- **HIGH** — hardcoded color or shadow with an exact token equivalent; copy-pasted style block across 3+ files.
- **MEDIUM** — hardcoded spacing/radius with a close token equivalent; inconsistent sizing across similar components.
- **LOW** — minor spacing mismatch; one-off value that could use a token for consistency but isn't visually broken.

For each finding: file path, line (approx), the hardcoded value, and the suggested token replacement.

**Phase 3 — Fix.** After user approval, apply fixes:
- Replace hardcoded values → token references.
- Extract repeated style blocks → named exports in `styles.ts` (shared) or feature `styles.ts`.
- Standardize sizing for similar component types (icon buttons → `iconButtonBase` size, chips → `chipBase`, etc.).
- Run `tsc --noEmit`, `biome check`, and `vitest run` to confirm no regressions.

**Reference files:**
- Token definitions: `apps/web/src/index.css`
- Shared style presets: `apps/web/src/components/styles.ts`
- Design system spec: `Docs/DESIGN_SYSTEM.md`
- Structural layer audit (complementary): `Docs/CURSOR_STYLE_LAYER_AUDIT.md`
