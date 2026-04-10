# Scheduled Tasks Configuration

The overnight workflow uses one scheduled task (implementation) and one manual command (review).

**Timezone note:** Cron expressions are UTC. 1 AM Mountain (MDT/UTC-6) = 7 AM UTC. When DST ends (November), this shifts by 1 hour — update cron expression or accept the drift.

**Review:** Run `/morning-review` manually in an interactive Claude Code session. See CLAUDE.md § Repeatable Commands.

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

