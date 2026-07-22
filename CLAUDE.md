# CLAUDE.md — QuestLog

QuestLog is a single-user AI campaign manager for tabletop RPG DMs. v1's primary interface is an **MCP server** (`apps/mcp`) exposing lore query, entity lookup, session logging, and prep-brief tools over a Fastify + tRPC + Drizzle/pgvector backend (`apps/server`, `packages/shared`). The only kept web surface is SourcesPage; everything else is v2.

**The only task source is [`Docs/MILESTONES_V1_MCP.md`](Docs/MILESTONES_V1_MCP.md).** Never pull work from `MILESTONES_PT1.md`/`PT2.md` — they're retained for detail only.

## Principles

- **TDD, no exceptions.** Red → Green → Refactor. Write a failing test before implementation code.
- **Thin routers → services → Drizzle.** Routers validate (Zod) and delegate; business logic lives in services.
- **Zod at every boundary.** All tRPC input is validated. `packages/shared` is the single source of truth for cross-app types.
- **DRY.** Reuse existing services/components before writing new ones.
- **Comments: WHY only, once.** Write a comment only for a non-obvious WHY (hidden constraint, workaround, tradeoff) — never restate WHAT. If the same rationale applies at multiple call sites, write it once in `Docs/IMPLEMENTATION_NOTES.md` and leave a one-line pointer at each site, not a duplicated paragraph.
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

## Pointer map — load only when the ticket directs you to

- Conventions detail → `Docs/DEVELOPMENT_GUIDE.md`
- Non-obvious gotchas → `Docs/IMPLEMENTATION_NOTES.md`
- Visual reference → `Docs/mockups/` + `Docs/DESIGN_SYSTEM.md`
- Path-scoped patterns → `.claude/rules/` (loads automatically when matching files are touched)

## Hard rules for autonomous runs

- `main` is the deployed branch — never push to it, never target it. Ticket branches cut from `develop`, PR back into `develop`. Never merge a PR yourself.
- Never modify files under `Docs/mockups/`.
- Obey the ticket's iteration cap. On cap, follow the Blocked Protocol (`Docs/tickets/BLOCKED_TEMPLATE.md`) and stop.
- A ticket referencing a mockup is not visually gated — the mockup is the answer. A 🧠 strategy gate has no answer available to you — skip it, log it in the report, continue to the next ticket.
