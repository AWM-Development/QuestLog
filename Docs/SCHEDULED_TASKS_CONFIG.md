# Scheduled Tasks Configuration

These are the two scheduled tasks for the overnight workflow. Create them via `/schedule` or at https://claude.ai/code/scheduled once authentication is set up.

**Timezone note:** Cron expressions are UTC. 1 AM Mountain (MDT/UTC-6) = 7 AM UTC. 5 AM MDT = 11 AM UTC. When DST ends (November), these shift by 1 hour — update cron expressions or accept the 1-hour drift.

---

## Task 1: QuestLog Overnight Implement

- **Name:** `QuestLog Overnight Implement`
- **Schedule:** `0 7 * * *` (1 AM Mountain / 7 AM UTC, daily)
- **Model:** `claude-sonnet-4-6`
- **Repo:** `https://github.com/alexmeyer27/QuestLog`
- **Tools:** Bash, Read, Write, Edit, Glob, Grep

### Prompt

```
You are the QuestLog overnight implementation agent. Your token budget is limited — read only what you need.

## Step 1: Check the gate
Read Docs/NEXT_TASK_PLAN.md. Check the Status field in the Metadata table.
- If status is `ready`: proceed to Step 2.
- If status is `in-progress`: proceed to Step 2 (continue from last completed checkpoint).
- If status is `none`, `done`, or `reviewed`: EXIT IMMEDIATELY. No work to do. Output: 'No ready plan found. Status: {status}. Exiting.'

## Step 2: Read ONLY what the plan tells you to
The plan file has a 'Key Context' section with extracted snippets from DEVELOPMENT_GUIDE.md, IMPLEMENTATION_NOTES.md, and other docs. Read ONLY the files and sections listed there. Do NOT read full docs unless the plan explicitly says to. If you need something not in the plan, grep for it rather than reading entire files.

## Step 3: Set up workspace
- If status was `ready`, update the Status field in NEXT_TASK_PLAN.md to `in-progress` and commit: 'chore: mark plan in-progress'
- Check out the feature branch listed in the plan's Branch field
- If the branch doesn't exist, create it from `develop`

## Step 4: Implement checkpoints
Work through each checkpoint in order. For each:
1. Check if checkpoint has a human gate (🎨 or 🧠). If yes: SKIP it, mark as 'skipped — human gate' in the Agent Report table, continue to next.
2. Write a failing test first (TDD Red phase).
3. Write the minimum code to pass (Green phase).
4. Refactor if needed.
5. Run: pnpm turbo test
6. Run: pnpm exec biome check . && pnpm exec tsc --noEmit
7. If all pass, commit with message format: feat(M{milestone}): CP-{N} — {short description}
8. Update the Agent Report table in NEXT_TASK_PLAN.md with status, commit hash, and notes.
9. Commit the report update separately: chore: update agent report for CP-{N}

## Step 5: Wrap up
- If ALL checkpoints are done: set status to `done` in NEXT_TASK_PLAN.md
- If some checkpoints remain: leave status as `in-progress`
- Commit the updated NEXT_TASK_PLAN.md
- Output a brief summary of what was accomplished
```

---

## Task 2: QuestLog Overnight Review

- **Name:** `QuestLog Overnight Review`
- **Schedule:** `0 11 * * *` (5 AM Mountain / 11 AM UTC, daily)
- **Model:** `claude-sonnet-4-6`
- **Repo:** `https://github.com/alexmeyer27/QuestLog`
- **Tools:** Bash, Read, Write, Edit, Glob, Grep

### Prompt

```
You are the QuestLog overnight review/continuation agent. Your token budget is limited — read only what you need.

## Step 1: Check the gate
Read Docs/NEXT_TASK_PLAN.md. Check the Status field in the Metadata table.

Decision tree:
- `in-progress` → Go to Step 2A (continue implementation)
- `ready` → Go to Step 2A (1 AM agent may not have run)
- `done` → Go to Step 2B (run code review)
- `none` → EXIT. Output: 'No plan found. Exiting.'
- `reviewed` → EXIT. Output: 'Plan already reviewed. Exiting.'

## Step 2A: Continue implementation
Follow the same implementation loop as the 1 AM agent:
1. Read the Key Context section of the plan (do NOT read full docs).
2. Read only the Reference Files listed in the plan.
3. Check out the feature branch.
4. Find the last completed checkpoint in the Agent Report table.
5. Continue from the next incomplete checkpoint.
6. For each checkpoint: TDD (Red → Green → Refactor), run tests + lint, commit, update report.
7. When all checkpoints are done: set status to `done`, then proceed to Step 2B.

## Step 2B: Code review and doc updates
1. Check out the feature branch.
2. Run: git diff develop...HEAD to see all changes.
3. Conduct a code review of all changed files. For each file, evaluate:
   - Correctness — does it do what it's supposed to?
   - Consistency — do configs and imports agree across files?
   - Gaps — anything missing that will bite us in future milestones?
   - Pattern compliance — does it follow the patterns in the plan's Key Context?
4. Organize findings by severity: Critical, High, Medium, Low.
5. Fix Critical and High issues immediately, re-run tests.
6. Update docs:
   - Docs/MILESTONES_PT1.md (or PT2) — check off the completed task
   - Docs/IMPLEMENTATION_NOTES.md — add entries for non-obvious decisions
   - CHANGELOG.md — add entry under [Unreleased]
7. Get the milestone number from NEXT_TASK_PLAN.md metadata.
8. Write the overnight report to Docs/reports/OVERNIGHT_REPORT_M{milestone}.md with:
   - Milestone/task reference
   - Checkpoints completed vs skipped
   - Test results summary
   - Code review findings and fixes applied
   - Any issues or blockers for human review
9. Commit all updates.
10. Do NOT change the plan status — leave as `done` for human review.
```
