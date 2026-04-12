# Overnight Agent Workflow

**Purpose:** Describes the plan-implement-review loop that lets a human plan tasks during the day and a scheduled Claude Code agent implement them overnight.

**Last Updated:** 2026-04-12

---

## Overview

The workflow has three phases:

| Phase | When | Who | What |
|-------|------|-----|------|
| **Plan** | Daytime (interactive) | Human + Claude | Resolve design decisions, break task into checkpoints, write plan file, create feature branch, set status to `ready` |
| **Implement** | 1 AM MT (scheduled) | Claude agent | Read plan, check out feature branch, implement checkpoint-by-checkpoint with TDD, commit after each |
| **Review** | Morning (interactive) | Human + Claude | Run `/morning-review` — code review, doc updates, overnight report, merge to develop |

---

## Branch Strategy

- **`main`** — reviewed and deployed code only
- **`develop`** — orchestration layer: contains the plan file (`NEXT_TASK_PLAN.md`) and process documentation. No in-progress feature code.
- **Feature branches** — created off `develop` during daytime planning. All implementation happens here. The overnight agent checks out the branch specified in the plan — it never works on `develop` directly.

**Code flow:** feature branch → develop (after human review) → main (for deployment)

The overnight agent never pushes to `main` or `develop`. It only commits to the feature branch.

---

## Milestone Directory Structure

Each milestone gets a dedicated directory under `Docs/milestones/`. This is the one-stop shop for all milestone-specific documentation.

```
Docs/
├── milestones/
│   ├── M4.1/
│   │   ├── PLAN.md          ← detailed plan with checkpoints
│   │   ├── DESIGN_SPEC.md   ← visual specs, interaction states (if applicable)
│   │   └── REPORT.md        ← overnight agent writes this after work
│   ├── M4.2/
│   │   ├── PLAN.md
│   │   ├── DESIGN_SPEC.md
│   │   └── REPORT.md
│   └── ...
├── milestones-archive/       ← completed milestones move here
│   └── M3.3/
│       ├── PLAN.md
│       └── REPORT.md
├── NEXT_TASK_PLAN.md         ← control file on develop (status + pointer to milestone dir)
├── PLAN_TEMPLATE.md          ← copy to Docs/milestones/M{X}/PLAN.md
├── DESIGN_SYSTEM.md          ← overarching design tokens, not milestone-specific
└── OVERNIGHT_AGENT.md        ← this file
```

### What goes where

| Document | Location | Purpose |
|----------|----------|---------|
| **DESIGN_SYSTEM.md** | `Docs/DESIGN_SYSTEM.md` | Overarching: CSS tokens, spacing scale, color system, component anatomy. Stable across milestones. |
| **DESIGN_SPEC.md** | `Docs/milestones/M{X}/DESIGN_SPEC.md` | Milestone-specific: wireframes, visual specs, layout decisions, interaction states. Created during planning when 🎨 gates are resolved. |
| **PLAN.md** | `Docs/milestones/M{X}/PLAN.md` | Full plan with checkpoints, key context, constraints. Copy from `PLAN_TEMPLATE.md`. |
| **REPORT.md** | `Docs/milestones/M{X}/REPORT.md` | Overnight report. Written by the agent or `/morning-review`. |
| **NEXT_TASK_PLAN.md** | `Docs/NEXT_TASK_PLAN.md` | Control file on develop. Contains only status, milestone number, and branch — points to `Docs/milestones/M{X}/PLAN.md` for details. |

### Plan archival

When a milestone is completed and merged:
1. Move `Docs/milestones/M{X}/` → `Docs/milestones-archive/M{X}/`
2. Reset `NEXT_TASK_PLAN.md` status to `none`
3. The next planning session creates a new `Docs/milestones/M{Y}/` directory

---

## The Plan File

### Control file: `Docs/NEXT_TASK_PLAN.md`

Lives on the `develop` branch. The overnight agent checks this file first to decide whether to work.

Contains only:
- **Status field** (the gate)
- **Milestone number** (e.g., `M4.2`)
- **Feature branch name** (e.g., `feat/session-log/dock-model`)
- **Pointer** to the full plan: `Docs/milestones/M{X}/PLAN.md`

### Detail file: `Docs/milestones/M{X}/PLAN.md`

The full plan with checkpoints, key context, constraints, and agent report sections. Lives on the feature branch (committed during planning). Copy from `Docs/PLAN_TEMPLATE.md`.

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

---

## Daytime Planning Session

During an interactive session, the human and Claude:

1. Identify the next unchecked task in `MILESTONES_PT1.md` or `MILESTONES_PT2.md`
2. Read the relevant PRD section and `Docs/DESIGN_SYSTEM.md` (overarching tokens)
3. Resolve 🎨 Visual Spec and 🧠 Strategy gates — make all design decisions upfront
4. Create the milestone directory: `Docs/milestones/M{X}/`
5. If visual specs were resolved, write them to `Docs/milestones/M{X}/DESIGN_SPEC.md`
6. Break the task into numbered checkpoints (each = one testable behavior change)
7. For each checkpoint: list target files, describe the failing test, define acceptance criteria
8. **Extract key context into the plan** (critical for token efficiency):
   - Copy the specific DEVELOPMENT_GUIDE.md subsections the agent needs (not the whole file)
   - Copy relevant IMPLEMENTATION_NOTES.md entries
   - Paste resolved design decisions verbatim
   - Reference `Docs/milestones/M{X}/DESIGN_SPEC.md` if visual specs exist
   - List specific reference files the agent should read (existing code to extend, test patterns to follow)
9. Copy `Docs/PLAN_TEMPLATE.md` → `Docs/milestones/M{X}/PLAN.md` and fill in all sections
10. Create the feature branch off `develop`
11. Commit the milestone directory to the feature branch
12. Update `Docs/NEXT_TASK_PLAN.md` on develop with status `ready`, milestone number, branch name, and pointer to the plan
13. Commit and push develop

**Checkpoint scoping:** Each checkpoint should represent one testable behavior change — small enough that partial progress is useful, large enough that it's a meaningful commit.

**Why extract context?** The overnight agent has a fixed token budget. Every doc it reads consumes tokens that could go toward implementation. By front-loading context extraction during planning (when you have full docs open anyway), the agent can skip reading 5+ large files and go straight to coding.

---

## 1 AM Agent (Implement)

**Schedule:** Daily at 1:00 AM Mountain Time (08:00 UTC)

### Startup Sequence (Scheduled Session)

The overnight agent uses a **minimal-context preamble** to conserve tokens. Every file read costs tokens — only read what the plan tells you to.

1. Read `Docs/NEXT_TASK_PLAN.md` — check the status field. If not `ready` or `in-progress`: exit immediately.
2. Note the milestone number and feature branch from the control file.
3. Check out the feature branch.
4. Read `Docs/milestones/M{X}/PLAN.md` — the full plan with checkpoints and key context.
5. If `Docs/milestones/M{X}/DESIGN_SPEC.md` exists, read it for visual/interaction specs.
6. Read only the **Reference Files** listed in the plan's Key Context section.

**Token conservation rules:**
- Do NOT read MILESTONES, PRD, or the overarching DESIGN_SYSTEM.md — the plan contains everything needed.
- Do NOT read full docs when the plan has already extracted the relevant snippets.
- If you need context not in the plan, use `grep` to find specific patterns rather than reading entire files.
- Read implementation files on-demand per checkpoint, not all at once upfront.

**Search path for milestone context (in order):**
1. `Docs/milestones/M{X}/PLAN.md` — checkpoints, key context, constraints
2. `Docs/milestones/M{X}/DESIGN_SPEC.md` — visual specs (if exists)
3. Reference files listed in the plan
4. `grep` for specific patterns if none of the above cover a need

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

After the last checkpoint (or when token budget is exhausted):
- Write/update `Docs/milestones/M{X}/REPORT.md`
- Set status to `done` (if all checkpoints complete) or leave as `in-progress` (if partial)
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
2. Check out the feature branch and show commits/files changed
3. Run the code review protocol on all changed files
4. Fix Critical/High issues
5. Update docs (MILESTONES, IMPLEMENTATION_NOTES, CHANGELOG, PRD if needed)
6. Write/update `Docs/milestones/M{X}/REPORT.md`
7. After your approval, set status to `reviewed` and offer to merge to develop

### Milestone completion

When a milestone is fully completed and merged to develop:
1. Move `Docs/milestones/M{X}/` → `Docs/milestones-archive/M{X}/`
2. Reset `NEXT_TASK_PLAN.md` to `status: none`

---

## Status as Lock

- The status field is the single lock mechanism
- If the overnight agent crashes without updating status, it remains `ready` — next run picks up from the first incomplete checkpoint
- The human should not set status to `ready` while an agent is running

---

## File Reference

| File | Location | Purpose |
|------|----------|---------|
| `Docs/PLAN_TEMPLATE.md` | develop | Copy-paste template for new plans |
| `Docs/NEXT_TASK_PLAN.md` | develop | Control file — status gate for overnight agents |
| `Docs/OVERNIGHT_AGENT.md` | develop | This file — workflow documentation |
| `Docs/DESIGN_SYSTEM.md` | develop | Overarching design tokens (stable across milestones) |
| `Docs/milestones/M{X}/PLAN.md` | feature branch | Full plan with checkpoints and key context |
| `Docs/milestones/M{X}/DESIGN_SPEC.md` | feature branch | Visual specs for this milestone (if applicable) |
| `Docs/milestones/M{X}/REPORT.md` | feature branch | Overnight report for this milestone |
| `Docs/milestones-archive/M{X}/` | develop | Completed milestone docs (archived after merge) |
