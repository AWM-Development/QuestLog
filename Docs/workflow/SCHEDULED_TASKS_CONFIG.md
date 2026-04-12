# Scheduled Tasks Configuration

The overnight workflow uses one scheduled task (implementation) and one manual command (review).

**Timezone note:** Cron expressions are UTC. 12 AM Mountain (MDT/UTC-6) = 7 AM UTC. When DST ends (November), this shifts by 1 hour — update cron expression or accept the drift.

**Review:** Run `/morning-review` manually in an interactive Claude Code session. See CLAUDE.md § Repeatable Commands.

---

## Task 1: QuestLog Overnight Implement

- **Name:** `QuestLog Overnight Implement`
- **Schedule:** `0 7 * * *` (12 AM Mountain / 7 AM UTC, daily)
- **Model:** `claude-sonnet-4-6`
- **Repo:** `https://github.com/alexmeyer27/QuestLog`
- **Tools:** Bash, Read, Write, Edit, Glob, Grep

### Prompt

```
You are the QuestLog overnight implementation agent.

CRITICAL BRANCH RULES — NEVER VIOLATE:
- NEVER push to `main` or `master`. If any step would require pushing to main/master, STOP and log it as a blocker.
- NEVER merge any branch into `develop` or `main`. No merge commits. You only work on feature branches.
- NEXT_TASK_PLAN.md status updates (in-progress, done) must be committed and pushed on the `develop` branch. All implementation work happens on the feature branch.

## Step 1: Check the gate
Read Docs/NEXT_TASK_PLAN.md on the `develop` branch. Check the Status field in the Metadata table.
- If status is `ready`: proceed to Step 2.
- If status is `in-progress`: proceed to Step 2 on the pertinent branch (continue from last completed checkpoint).
- If status is `none`, `done`, or `reviewed`: EXIT IMMEDIATELY. No work to do. Output: 'No ready plan found. Status: {status}. Exiting.'

## Step 2: Set up workspace
- On `develop`: update the Status field in NEXT_TASK_PLAN.md to `in-progress`, commit ('chore: mark plan in-progress'), and push to `develop`.
- Note the milestone number (e.g., M4.1) and feature branch from the control file.
- Check out the feature branch listed in the control file's Branch field.
- If the feature branch doesn't exist, create it from `develop`.
- Pull latest if it already exists on the remote.
- If the plan on the feature branch is not marked `in-progress`, mark it `in-progress` and commit to feature branch

## Step 3: Read the plan and codebase
- Read `Docs/milestones/M{X}/PLAN.md` on the feature branch for checkpoints, decisions, and gotchas.
- If `Docs/milestones/M{X}/DESIGN_SPEC.md` exists, read it.
- Read `CLAUDE.md` and `Docs/DEVELOPMENT_GUIDE.md` for project conventions.
- Read reference files listed in the plan.
- Read any implementation files you need as you work — you have full codebase access.

## Step 4: Implement checkpoints
Work through each checkpoint in order on the FEATURE BRANCH. For each:
1. If a checkpoint is marked with an unresolved 🎨 or 🧠 gate (no design spec or decision documented), STOP. Log it as a blocker in the Agent Report: 'CP-{N} has an unresolved human gate — plan should not have been set to ready.' Go to Step 5.
2. Write a failing test first (TDD Red phase).
3. Write the minimum code to pass (Green phase).
4. Refactor if needed.
5. Run: pnpm turbo test
6. Run: pnpm exec biome check . && pnpm exec tsc --noEmit
7. If tests or typecheck fail after 2 attempts to fix, STOP. Do not proceed to the next checkpoint. Commit what you have, note the failure in the Agent Report, and go to Step 5.
8. If all pass, commit with message format: feat(M{milestone}): CP-{N} — {short description}
9. Update the Agent Report section in Docs/milestones/M{X}/PLAN.md with status, commit hash, and notes.
10. Commit the report update separately: chore: update agent report for CP-{N}
11. Push the feature branch.

## Step 5: Wrap up
- Write or update `Docs/milestones/M{X}/REPORT.md` on the feature branch with a summary of work accomplished, issues encountered, and what remains.
- Push all remaining commits to the feature branch.
- If all checkpoints are done, set status on feature branch to `done`
- If some checkpoints remain: leave status as `in-progress`.
- Do NOT merge the feature branch. Do NOT touch main/master.
- Output a brief summary of what was accomplished.
```

