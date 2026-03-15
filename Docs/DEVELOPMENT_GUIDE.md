# QuestLog — Development Guide

**Location:** `Docs/DEVELOPMENT_GUIDE.md`

**Purpose:** Repeatable instructions for every feature implementation session. Read this at the start of each coding session. It defines the patterns, testing discipline, review process, and conventions that keep the codebase consistent as features accumulate.

**Related Docs:**
- `Docs/README.md` — Overview of all project documentation
- `Docs/PRD.md` — Product specification (reference for feature details)
- `Docs/MILESTONES.md` — Task breakdown with branch names

**Last Updated:** 2026-03-15

---

## 1. Project Structure

```
questlog/
├── apps/
│   ├── web/                    # React frontend (Vite + Tailwind)
│   │   ├── src/
│   │   │   ├── components/     # Shared UI components
│   │   │   ├── features/       # Feature modules (co-located)
│   │   │   │   ├── agent-chat/
│   │   │   │   │   ├── components/
│   │   │   │   │   ├── hooks/
│   │   │   │   │   ├── api.ts       # tRPC hook wrappers
│   │   │   │   │   └── index.ts
│   │   │   │   ├── session-log/
│   │   │   │   ├── entity-graph/
│   │   │   │   └── ...
│   │   │   ├── layouts/
│   │   │   ├── lib/            # Utilities, constants, types
│   │   │   ├── styles/         # Global styles, theme tokens
│   │   │   └── App.tsx
│   │   └── vite.config.ts
│   └── server/                 # Fastify + tRPC backend
│       ├── src/
│       │   ├── routers/        # tRPC routers (one per domain)
│       │   │   ├── campaign.ts
│       │   │   ├── session.ts
│       │   │   ├── entity.ts
│       │   │   └── _app.ts     # Root router (merges all)
│       │   ├── services/       # Business logic layer
│       │   │   ├── import.service.ts
│       │   │   ├── rag.service.ts
│       │   │   ├── entity.service.ts
│       │   │   └── ...
│       │   ├── db/
│       │   │   ├── schema/     # Drizzle schema definitions
│       │   │   ├── migrations/ # Generated migrations
│       │   │   └── index.ts    # DB client export
│       │   ├── lib/            # Shared utilities
│       │   └── server.ts       # Fastify app + tRPC plugin
│       └── vitest.config.ts
├── packages/
│   └── shared/                 # Shared types, validators, constants
│       ├── src/
│       │   ├── types/          # Shared TypeScript types
│       │   ├── validators/     # Zod schemas (shared input validation)
│       │   └── constants/
│       └── package.json
├── package.json                # Workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .env.example
├── docker-compose.yml          # Local Postgres + pgvector
└── PRD.md
```

### Why This Structure

**Feature co-location (frontend):** Each feature owns its components, hooks, and API bindings. This prevents the "200 files in /components" problem and makes it obvious where new code for a feature goes.

**Router → Service → DB (backend):** tRPC routers are thin — they validate input (via Zod) and call services. Services contain business logic. DB access goes through Drizzle. This separation makes testing straightforward: you can test services without HTTP, and routers without a real database.

**Shared package:** Types and Zod schemas that both frontend and backend need live in `packages/shared`. This is the core benefit of the monorepo — a single source of truth for data shapes.

---

## 2. Tooling Choices

| Tool | Role | Why |
|---|---|---|
| **pnpm** | Package manager | Fast, disk-efficient, strict dependency resolution |
| **Turborepo** | Build orchestration | Minimal config, fast cached builds, good enough for solo dev |
| **Vitest** | Testing | Vite-native, fast, TypeScript-first, Jest-compatible API |
| **Zod** | Validation | Runtime type validation, integrates with tRPC and Drizzle |
| **Biome** | Linting + formatting | Single tool, fast (Rust-based), replaces ESLint + Prettier |

---

## 3. Branching Strategy

### Branch Naming

```
main                          # Always deployable
├── feat/<milestone>/<task>   # Feature work
├── fix/<description>         # Bug fixes
├── refactor/<description>    # Non-functional improvements
└── chore/<description>       # Tooling, config, deps
```

**Examples:**
- `feat/foundation/db-schema`
- `feat/import-pipeline/pdf-extraction`
- `feat/agent-chat/context-assembly`
- `fix/entity-linking-duplicate-detection`
- `chore/ci-pipeline-setup`

### Workflow Per Feature

```
1. Branch from main            →  git checkout -b feat/milestone/task
2. Implement with TDD          →  (see §4)
3. Self-review                 →  (see §7)
4. Squash merge to main        →  git merge --squash feat/milestone/task
5. Delete feature branch       →  git branch -d feat/milestone/task
```

Keep branches short-lived. A feature branch should live for 1–3 sessions max. If a feature is bigger than that, break it into smaller branches that each merge independently.

---

## 4. Test-Driven Development

### The Discipline

Every feature follows Red → Green → Refactor:

1. **Red:** Write a failing test that describes the behavior you want.
2. **Green:** Write the minimum code to make it pass.
3. **Refactor:** Clean up while tests stay green.

This isn't optional or aspirational — it's the process. The benefit for a learning project is enormous: tests force you to think about interfaces before implementation, and they catch regressions as you learn and refactor.

### Testing Layers

| Layer | What to Test | Tool | Location |
|---|---|---|---|
| **Unit** | Services, utilities, pure functions, Zod schemas | Vitest | `*.test.ts` next to source file |
| **Integration** | tRPC routers with real DB, RAG pipeline end-to-end | Vitest + test DB | `*.integration.test.ts` next to source file |
| **Component** | React components in isolation | Vitest + Testing Library | `*.test.tsx` next to component |
| **E2E** | Critical user flows (import → chat → get answer) | Playwright (later) | `e2e/` directory |

### What to Test (Prioritized)

**Always test:**
- Service layer business logic (this is where bugs hide)
- Zod schema validation (input validation is a security boundary)
- tRPC router handlers (integration tests with test DB)
- Data transformations (chunking, entity extraction, context assembly)

**Test when meaningful:**
- React components with meaningful interaction logic (not purely presentational)
- Custom hooks with state management logic

**Skip or defer:**
- Purely presentational components (a styled button with no logic)
- Third-party library wrappers with no custom logic
- E2E tests (add these after core features stabilize)

### Test File Convention

```
# Unit tests live next to source
services/
  ├── import.service.ts
  ├── import.service.test.ts          # Unit tests
  └── import.service.integration.test.ts  # Integration tests

# Component tests live next to component
components/
  ├── EntityCard.tsx
  └── EntityCard.test.tsx
```

### Test Database

Integration tests use a dedicated test database. Docker Compose spins up Postgres with pgvector locally. Each test suite gets a clean schema via transaction rollback or truncation.

```typescript
// Example pattern: wrap each test in a transaction that rolls back
beforeEach(async () => {
  await db.execute(sql`BEGIN`);
});

afterEach(async () => {
  await db.execute(sql`ROLLBACK`);
});
```

### Coverage Target

Aim for **high coverage on the service layer** (80%+). Don't chase a global coverage number — 80% on business logic is worth more than 95% that includes trivial getters.

---

## 5. Code Patterns

### 5.1 tRPC Router Pattern

Routers are thin. They validate input, call a service, and return the result.

```typescript
// routers/session.ts
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { sessionService } from "../services/session.service";

export const sessionRouter = router({
  create: protectedProcedure
    .input(z.object({
      campaignId: z.string().uuid(),
      title: z.string().max(200).optional(),
      content: z.string(),
    }))
    .mutation(({ input }) => {
      return sessionService.create(input);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input }) => {
      return sessionService.getById(input.id);
    }),
});
```

### 5.2 Service Pattern

Services own business logic. They receive validated input and return typed output. They call the DB layer and external APIs.

```typescript
// services/session.service.ts
import { db } from "../db";
import { sessions, entities } from "../db/schema";
import { embedContent } from "./rag.service";
import { extractEntities } from "./entity.service";

export const sessionService = {
  async create(input: CreateSessionInput): Promise<Session> {
    // 1. Insert session record
    const session = await db.insert(sessions).values(input).returning();

    // 2. Process content (async — don't block the response)
    void this.processContent(session.id, input.content);

    return session;
  },

  async processContent(sessionId: string, content: string): Promise<void> {
    // Chunk, embed, extract entities — runs in background
    await embedContent(content, { sourceType: "session", sourceId: sessionId });
    await extractEntities(content, { sessionId });
  },
};
```

### 5.3 Drizzle Schema Pattern

```typescript
// db/schema/sessions.ts
import { pgTable, uuid, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns";

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id").references(() => campaigns.id).notNull(),
  sessionNumber: integer("session_number").notNull(),
  title: text("title"),
  summary: text("summary"),
  content: text("content").notNull(),
  tags: jsonb("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### 5.4 Frontend Feature Pattern

Each feature module exports a barrel file. Components use tRPC hooks directly.

```typescript
// features/session-log/hooks/useSessionNotes.ts
import { trpc } from "@/lib/trpc";

export function useSessionNotes(campaignId: string) {
  const utils = trpc.useUtils();

  const saveMutation = trpc.session.create.useMutation({
    onSuccess: () => {
      utils.session.list.invalidate({ campaignId });
    },
  });

  return { saveMutation };
}
```

### 5.5 Error Handling Pattern

Use typed errors, not string messages. Services throw; routers catch and translate to tRPC errors.

```typescript
// lib/errors.ts
export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// In router middleware or error handler:
// NotFoundError → TRPCError({ code: "NOT_FOUND" })
// ValidationError → TRPCError({ code: "BAD_REQUEST" })
```

---

## 6. Guiding Principles

### Type Safety Is Non-Negotiable
The entire point of tRPC + Drizzle + Zod is end-to-end type safety. If you find yourself using `any`, `as unknown`, or suppressing TypeScript errors, stop and fix the types. The type system is your first line of defense against bugs.

### Thin Routers, Thick Services
Routers validate and delegate. Services contain logic. This makes testing easy (test services directly) and keeps the API layer clean. Never put business logic in a router handler.

### Co-locate, Don't Scatter
Tests live next to source files. Feature components live in feature directories. A developer (you, in 3 months) should be able to find everything related to a feature in one directory without grep.

### Fail Fast, Fail Loud
Validate at the boundary (Zod schemas on tRPC input). Throw typed errors when something is wrong. Don't silently swallow errors or return partial results without flagging them.

### Optimize Later
Don't add caching, connection pooling, query optimization, or any performance work until you have a working feature and can measure a real problem. Ship correct first, then make it fast.

### Commit Small, Commit Often
Each commit should be a single logical change that compiles and passes tests. "Add session schema and migration" is a commit. "Add session service with tests" is another. "Wire up session tRPC router" is a third. Don't bundle an entire feature into one commit.

### Leave a Trail
Write commit messages that explain *why*, not *what*. Add JSDoc comments to service methods that have non-obvious behavior. Use TODO comments sparingly but intentionally for known shortcuts: `// TODO: add pagination when session count exceeds 50`.

---

## 7. Feature Completion Checklist

Run through this before merging **every** feature branch. This is your self-review since you don't have a second pair of eyes.

### Code Quality
- [ ] `pnpm turbo lint` passes with zero errors
- [ ] `pnpm turbo typecheck` passes with zero errors
- [ ] No `any` types, no `@ts-ignore`, no `eslint-disable` without a justifying comment
- [ ] No hardcoded secrets, API keys, or credentials
- [ ] Error cases are handled (not just the happy path)

### Tests
- [ ] All new service methods have unit tests
- [ ] All new tRPC endpoints have integration tests
- [ ] All tests pass: `pnpm turbo test`
- [ ] Tests cover both success and failure cases
- [ ] No skipped tests (`test.skip`) without a TODO and issue

### Types & Validation
- [ ] All tRPC inputs use Zod schemas (no unvalidated input)
- [ ] Shared types live in `packages/shared`, not duplicated
- [ ] Drizzle schema changes have a migration: `pnpm drizzle-kit generate`

### Database
- [ ] New migrations are generated and tested
- [ ] Migrations are idempotent (can run twice without error)
- [ ] No raw SQL unless Drizzle's query builder genuinely can't express it
- [ ] Indexes exist for columns used in WHERE clauses and JOINs

### Frontend (if applicable)
- [ ] Components handle loading, error, and empty states
- [ ] No layout shifts during data fetching (skeletons or placeholders)
- [ ] Accessible: semantic HTML, keyboard navigable, sufficient contrast
- [ ] Responsive: tested at desktop (1200px+) and tablet (768px) widths

### Before Merge
- [ ] `git diff main` — review every changed line yourself
- [ ] Run the full test suite one more time
- [ ] Commit history is clean (squash fixup commits)
- [ ] Update PRD.md if the implementation deviates from spec (spec stays in sync with reality)

---

## 8. Environment & Local Development

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker (for local Postgres)

### First-Time Setup
```bash
pnpm install
docker compose up -d              # Start Postgres + pgvector
cp .env.example .env              # Configure local env vars
pnpm drizzle-kit push             # Apply schema to local DB
pnpm turbo dev                    # Start both frontend and backend
```

### Common Commands
```bash
pnpm turbo dev                    # Start all apps in dev mode
pnpm turbo build                  # Build all apps
pnpm turbo test                   # Run all tests
pnpm turbo lint                   # Lint all apps
pnpm turbo typecheck              # Type-check all apps
pnpm drizzle-kit generate         # Generate migration from schema changes
pnpm drizzle-kit push             # Push schema directly (dev only)
```

### Environment Variables
```bash
# .env.example
DATABASE_URL=postgresql://questlog:questlog@localhost:5432/questlog
ANTHROPIC_API_KEY=sk-ant-...       # For Claude API (agent conversation)
OPENAI_API_KEY=sk-...              # For embeddings (text-embedding-3-small)
```

---

## 9. AI-Assisted Development Notes

Since you're using Claude for implementation, keep these patterns in mind:

### Starting a Coding Session
1. Reference this guide: "Read DEVELOPMENT_GUIDE.md for project conventions."
2. Reference the PRD: "Read PRD.md §4.X for the feature spec."
3. State the task clearly: "Implement the session service with TDD, following the patterns in the dev guide."

### What to Ask the AI to Do
- Write tests first, then implementation (enforce TDD)
- Follow the project structure (don't let it dump everything in one file)
- Generate Drizzle migrations alongside schema changes
- Run the test suite after implementation

### What to Verify Yourself
- Read the generated code — understand every line before committing
- Check that types flow end-to-end (tRPC input → service → DB → response)
- Verify the tests actually test meaningful behavior (not just "it doesn't crash")
- Make sure error handling exists and is tested

### Context to Provide Each Session
The AI doesn't remember previous sessions. At minimum, provide:
- This development guide
- The relevant PRD section
- The current file structure (`ls -R apps/server/src/`)
- Any relevant existing code (schemas, related services)

---

## 10. AI-Assisted Code Review Protocol

After the AI finishes implementing a task, ask it to conduct a code review using this format. Paste this prompt verbatim:

```
Conduct a code review of all files changed in this task. For each file, evaluate:
1. Correctness — does it do what it's supposed to?
2. Consistency — do configs and imports agree across files? Do tsconfigs reference each other properly? Do package.json deps match actual imports?
3. Gaps — anything missing that will bite us in future milestones?
4. Pattern compliance — does it follow the patterns in DEVELOPMENT_GUIDE.md (thin routers, service layer, Zod validation)?

Organize findings by severity: Critical, High, Medium, Low.
For each finding, include: file path, line number, what the issue is, and why it matters.
After listing findings, explicitly call out any false positives — items that look like issues but are intentional decisions.
Then fix any Critical or High issues immediately, re-run tests/lint/typecheck, and confirm all green.
```

### What to expect from the review

The AI will flag both real issues and false positives. Common false positives in this stack:

- **`.js` extensions in TypeScript imports** — Correct for ESM with `moduleResolution: "bundler"`. TypeScript resolves `.js` → `.ts` at compile time.
- **Workspace package exports pointing to `./src/*.ts`** — Intentional for internal `workspace:*` packages. Vite and tsx consume raw TS source; no build step needed.
- **Missing build scripts on `packages/shared`** — Same reason. Only add a build script if the package is published externally.
- **Dependencies installed but unused** — May be scaffolding for the next task. Check MILESTONES.md before removing.

### Severity definitions

| Severity | Description | Action |
|---|---|---|
| **Critical** | Will break tests, build, or runtime | Fix before any other work |
| **High** | Will cause bugs or fails silently in production | Fix in this PR |
| **Medium** | Best practice violation, future risk | Fix if low effort; otherwise create a chore/ branch |
| **Low** | Style, missing future-proofing | Defer unless trivially easy |

---

*This is a living document. Update it when patterns evolve, new conventions are established, or lessons are learned from implementation.*
