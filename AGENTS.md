# AGENTS.md — QuestLog

QuestLog is a single-user AI campaign manager for tabletop RPG DMs. v1's primary interface is an **MCP server** (`apps/mcp-stdio`, tools defined in `packages/mcp`) exposing lore query, entity lookup, session logging, and prep-brief tools over a Fastify + tRPC + Drizzle/pgvector backend (`apps/server`, `packages/core`, `packages/shared`). The only kept web surface is SourcesPage; everything else is v2.

**The task source is [`Docs/milestones/MILESTONES_V1_MCP.md`](Docs/milestones/MILESTONES_V1_MCP.md) (v1, shipped) plus [`Docs/milestones/MILESTONES_V1_1_MCP.md`](Docs/milestones/MILESTONES_V1_1_MCP.md) (v1.1, shipped 2026-08-10) plus [`Docs/milestones/MILESTONES_V1_2_MCP.md`](Docs/milestones/MILESTONES_V1_2_MCP.md) (v1.2, in progress — executor observability & efficiency) plus [`Docs/milestones/MILESTONES_V1_3_MCP.md`](Docs/milestones/MILESTONES_V1_3_MCP.md) (v1.3, in progress — canon correction & automatic entity extraction) plus [`Docs/milestones/MILESTONES_V1_4_MCP.md`](Docs/milestones/MILESTONES_V1_4_MCP.md) (v1.4, in progress — agent-interaction philosophy) plus [`Docs/milestones/MILESTONES_V1_5_MCP.md`](Docs/milestones/MILESTONES_V1_5_MCP.md) (v1.5, in progress — MCP app polish; M-INVENTORY within it stays gated on `G-023` until that decision lands) plus [`Docs/milestones/MILESTONES_V1_7_MCP.md`](Docs/milestones/MILESTONES_V1_7_MCP.md) (v1.7, in progress — M-PARTYMODEL has a real task list as of `G-024`'s resolution; M-NPCVOICE/M-CONTINUITY/M-PARTYKNOW/M-CROSSCAMPAIGN within it stay gated) plus [`Docs/milestones/MILESTONES_V1_10_MCP.md`](Docs/milestones/MILESTONES_V1_10_MCP.md) (v1.10, in progress — production readiness; both tasks interactive-only, gated on every other MCP-roadmap version shipping first) plus [`Docs/milestones/MILESTONES_BUGS.md`](Docs/milestones/MILESTONES_BUGS.md) (ongoing — bug reports found in shipped behavior; no version target, never closes).** `MILESTONES_PT1.md`/`PT2.md` no longer exist — their v2 task detail was consolidated into [`Docs/milestones/MILESTONES_V2.md`](Docs/milestones/MILESTONES_V2.md), which stays ineligible for ticket selection until Alex explicitly opens v2 planning.

## Principles

- **TDD, no exceptions.** Red → Green → Refactor. Write a failing test before implementation code.
- **Thin routers → services → Drizzle.** Routers validate (Zod) and delegate; business logic lives in services.
- **Zod at every boundary.** All tRPC input is validated. `packages/shared` is the single source of truth for cross-app types.
- **DRY, no sprawl.** Reuse existing services/components before writing new ones. Watch for the same pattern (a resolve-then-guard pair, a repeated literal/fixture, a near-identical helper) reappearing across files over the course of one ticket — generated code tends to reinstantiate logic at each new call site instead of consolidating it. Extract on the second occurrence, not the fifth.
- **Comments: WHY only, once.** Write a comment only for a non-obvious WHY (hidden constraint, workaround, tradeoff) — never restate WHAT. If the same rationale applies at multiple call sites, write it once in `Docs/IMPLEMENTATION_NOTES.md` and leave a one-line pointer at each site, not a duplicated paragraph.
- **Cite, don't restate.** This "write it once" rule isn't limited to code comments. Once a piece of rationale is captured in full in `Docs/IMPLEMENTATION_NOTES.md`, `.claude/rules/*.md` files, `CLAUDE.md`/`AGENTS.md` itself, and future ticket files must cite it with a one-line pointer (e.g. "see `IMPLEMENTATION_NOTES.md` § T-034") instead of restating it — even at a single call site. Tickets and reports already in `Docs/tickets/done/`/`archive/`/`reports/` are exempt: they're point-in-time records of what was true when written, not living documentation (`G-013`).
- **Never claim done without showing output.** Paste actual lint/typecheck/test output, not a description of it.
- **Squash-merge, short-lived branches.** One ticket, one branch, one PR.

## Commands

```bash
pnpm install && docker compose up -d && pnpm --filter @questlog/server db:migrate
pnpm build          # turbo build, all packages
pnpm lint           # Biome, all packages
pnpm typecheck      # tsc -b, all packages
pnpm test           # Vitest, all packages (needs Postgres on :5433, migrated)
```

## Session isolation — work in your own worktree

This applies to **every local session, not just the nightly executor.**
`T-069` built worktree isolation (`tmp/worktrees/<name>/`, cut from
`origin/develop`) for the ticket pipeline specifically — but two ordinary
interactive sessions sharing the primary checkout collide exactly the
same way, since the problem is files on disk, not git branches (`T-147`).

Before editing anything: if you're running locally (not a fresh,
inherently-isolated remote sandbox) and your working directory is the
shared primary checkout rather than already a `tmp/worktrees/*` path,
create/enter your own worktree first:

```bash
git fetch origin develop
git worktree add tmp/worktrees/<short-slug> -B <branch-name> origin/develop
cd tmp/worktrees/<short-slug>
```

Then do all work there — commits, pushes, everything. Skip this only for
genuinely read-only sessions that make no edits.

## Pointer map — load only when the ticket directs you to

- Lost in the repo tree / "where does X live" → `Docs/ARCHITECTURE.md`
- Conventions detail → `Docs/DEVELOPMENT_GUIDE.md`
- Non-obvious gotchas → `Docs/IMPLEMENTATION_NOTES.md`
- Pipeline commands quick reference → `Docs/tickets/COMMANDS.md` (or run `/command-help`)
- Visual reference → `Docs/mockups/` + `Docs/DESIGN_SYSTEM.md`
- Path-scoped patterns → `.claude/rules/` (loads automatically when matching files are touched)

## Hard rules for autonomous runs

- `main` is the deployed branch — never push to it, never target it. Ticket branches cut from `develop`, PR back into `develop`. Never merge a PR yourself.
- Never modify files under `Docs/mockups/`.
- Obey the ticket's iteration cap. On cap, follow the Blocked Protocol (`Docs/tickets/BLOCKED_TEMPLATE.md`) and stop.
- A ticket referencing a mockup is not visually gated — the mockup is the answer. A 🧠 strategy gate has no answer available to you — skip it, file it as a gate-stub in `Docs/tickets/gated/` (`Docs/tickets/GATE_SPEC.md`), note it in the report, continue to the next ticket. `/ungate` is the only way a gate gets resolved — never resolve one yourself.
