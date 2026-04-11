# Overnight Agent Workflow

**Purpose:** Describes the plan-implement-review loop that lets a human plan tasks during the day and a scheduled Claude Code agent implement them overnight.

**Last Updated:** 2026-04-09

---

## Overview

The workflow has three phases:

| Phase | When | Who | What |
|-------|------|-----|------|
| **Plan** | Daytime (interactive) | Human + Claude | Resolve design decisions, break task into checkpoints, write `NEXT_TASK_PLAN.md`, create feature branch, set status to `ready` |
| **Implement** | 1 AM MT (scheduled) | Claude agent | Read plan, implement checkpoint-by-checkpoint with TDD, commit after each |
| **Review** | Morning (interactive) | Human + Claude | Run `/morning-review` — code review, doc updates, overnight report, merge |

---

## Branch Strategy

- **`main`** — reviewed and deployed code only
- **`develop`** — completed work and process documentation, not yet deployed
- **Feature branches** — created off `develop` during daytime planning, worked on by the overnight agent

The overnight agent never pushes to `main`. Feature branches merge to `develop` after human review. `develop` merges to `main` for deployment.

---

## The Plan File

### Location

`Docs/NEXT_TASK_PLAN.md` on the `develop` branch. The overnight agent checks this file to decide whether to work.

### Status Field (the gate)

| Status | Meaning | Who sets it |
|--------|---------|-------------|
| `none` | No task planned | Default / human after clearing |
| `ready` | Plan is complete, agent may begin | Human (daytime) |
| `in-progress` | Agent is actively working | Agent (1 AM job) |
| `done` | All checkpoints complete | Agent (1 AM job) |
| `reviewed` | Human approved, ready to merge | Human (morning) |

**Rules:**
- The 1 AM agent only starts work when status is `ready`
- If status is `in-progress` (e.g. agent exhausted token budget mid-task), the next run picks up from the first incomplete checkpoint
- If status is `none`, `done`, or `reviewed`, the agent exits immediately
- If the agent exhausts its token budget mid-task, it commits current progress, updates the Agent Report, leaves status as `in-progress`, and stops — the morning review handles remaining checkpoints

### Template

See `Docs/PLAN_TEMPLATE.md` for the full template with all sections.

---

## Daytime Planning Session

During an interactive session, the human and Claude:

1. Identify the next unchecked task in `MILESTONES_PT1.md` or `MILESTONES_PT2.md`
2. Read the relevant PRD section and any design specs
3. Resolve 🎨 Visual Spec and 🧠 Strategy gates — make all design decisions upfront
4. Break the task into numbered checkpoints (each = one testable behavior change)
5. For each checkpoint: list target files, describe the failing test, define acceptance criteria
6. **Extract key context into the plan** (this is critical for token efficiency):
   - Copy the specific DEVELOPMENT_GUIDE.md subsections the agent needs (not the whole file)
   - Copy relevant IMPLEMENTATION_NOTES.md entries
   - Paste resolved design decisions verbatim
   - List specific reference files the agent should read (existing code to extend, test patterns to follow)
7. Create the feature branch off `develop`
8. Fill in `Docs/NEXT_TASK_PLAN.md` with all the above
9. Set the status field to `ready`
10. Commit and push to `develop`

**Checkpoint scoping:** Each checkpoint should represent one testable behavior change — small enough that partial progress is useful, large enough that it's a meaningful commit.

**Why extract context?** The overnight agent has a fixed token budget. Every doc it reads consumes tokens that could go toward implementation. By front-loading context extraction during planning (when you have full docs open anyway), the agent can skip reading 5+ large files and go straight to coding.

---

## 1 AM Agent (Implement)

**Schedule:** Daily at 1:00 AM Mountain Time (08:00 UTC)

### Startup Sequence (Scheduled Session)

The overnight agent uses a **minimal-context preamble** to conserve tokens. Every file read costs tokens — only read what the plan tells you to.

1. Read `Docs/NEXT_TASK_PLAN.md` — check the status field. If not `ready` or `in-progress`: exit immediately.
2. Read the **Key Context** section of the plan — this contains pre-extracted snippets from DEVELOPMENT_GUIDE.md, IMPLEMENTATION_NOTES.md, and other docs. Do NOT read the full source documents.
3. Read only the **Reference Files** listed in the plan's Key Context section.
4. Check out the feature branch specified in the plan metadata.

**Token conservation rules:**
- Do NOT read MILESTONES, PRD, or DESIGN_SYSTEM — the plan contains everything needed.
- Do NOT read full docs when the plan has already extracted the relevant snippets.
- If you need context not in the plan, use `grep` to find specific patterns rather than reading entire files.
- Read implementation files on-demand per checkpoint, not all at once upfront.

### Implementation Loop

For each checkpoint in order:

1. **Check for 🎨/🧠 gates** — if the checkpoint is gated, skip it and note in the report
2. **Assess token budget** — if fewer than ~10,000 tokens remain, go to Completion rather than starting a checkpoint you cannot finish
3. **Write failing test** (Red) — TDD is non-negotiable even for the agent
4. **Write minimum implementation** (Green)
5. **Refactor** if needed
6. **Run tests with minimal output** — `pnpm turbo test -- --reporter=dot`
7. **Run lint/typecheck** — `pnpm exec biome check . && pnpm exec tsc --noEmit`
8. **Commit** with message: `feat(M?.?): CP-N — short description`
9. **Check the box** for this checkpoint in the Agent Report Progress list
10. **Update the Run Log** in the Agent Report with status, commit hash, and notes
11. Commit the report update: `chore: update agent report for CP-N`

### Token Budget Management

- The agent commits after each checkpoint, so progress survives token exhaustion
- If tokens are running low, stop before starting the next checkpoint — a partial checkpoint is worse than none (nothing to commit, nothing to resume from)
- The Progress checklist in the Agent Report is the resume mechanism: the next run starts from the first unchecked item

### Completion

After the last checkpoint:
- Set status to `done`
- Commit the final report update

---

## Morning Review (Human + Claude)

The review phase runs manually in the morning via `/morning-review` in an interactive Claude Code session. This saves the scheduled task slot for implementation and gives the human direct control over the review.

### How to run

Start a Claude Code session in the QuestLog directory and type:

```
/morning-review
```

This triggers the full review protocol defined in CLAUDE.md (§ Repeatable Commands). It will:

1. Check `NEXT_TASK_PLAN.md` status and report what the overnight agent accomplished
2. Show commits, files changed, and any issues the agent flagged
3. Run the code review protocol on all changed files
4. Fix Critical/High issues
5. Update docs (MILESTONES, IMPLEMENTATION_NOTES, CHANGELOG, PRD if needed)
6. Write the overnight report to `Docs/reports/OVERNIGHT_REPORT_M{milestone}.md`
7. After your approval, set status to `reviewed` and offer to merge

### Overnight Report

The report file goes in `Docs/reports/` on the feature branch. Filename format: `OVERNIGHT_REPORT_M{milestone_number}.md` (e.g., `OVERNIGHT_REPORT_M4.2.md`).

Contents:
- Milestone/task reference
- Checkpoints completed vs skipped
- Test results summary
- Code review findings and fixes applied
- Any issues or blockers for human review
- Diff summary (files changed, lines added/removed)

---

## Status as Lock

- The status field is the single lock mechanism
- If the overnight agent crashes without updating status, it remains `ready` — next run picks up from the first incomplete checkpoint
- The human should not set status to `ready` while an agent is running

---

## File Reference

| File | Purpose |
|------|---------|
| `Docs/PLAN_TEMPLATE.md` | Copy-paste template for new task plans |
| `Docs/NEXT_TASK_PLAN.md` | Live plan file — the gate for overnight agents |
| `Docs/OVERNIGHT_AGENT.md` | This file — workflow documentation |
| `Docs/reports/OVERNIGHT_REPORT_M*.md` | Per-task overnight reports |
