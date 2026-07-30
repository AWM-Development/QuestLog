# Builds and runs apps/server for deployment (Fly.io — see Docs/DEPLOY_READINESS.md
# §2.1 and Docs/DEPLOY_SETUP_CHECKLIST.md). Not used for local dev (`pnpm dev`
# / docker-compose.yml is the local Postgres-only setup) — this image packages
# the Node process only.
#
# Build context MUST be the repo root (pnpm workspace), not apps/server/:
#   docker build -f apps/server/Dockerfile .
# fly.dev.toml / fly.prod.toml already point `[build] dockerfile` at this file
# with the implicit repo-root context, so `flyctl deploy -c fly.<env>.toml`
# from the repo root does the right thing without extra flags.
#
# Every stage keeps WORKDIR at /repo (the pnpm workspace root) so pnpm's
# symlinked node_modules layout (root node_modules/.pnpm store + per-package
# node_modules symlinks) stays valid when copied between stages — moving to a
# different absolute path would break the symlinks.

FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate
WORKDIR /repo

# ---- deps: full workspace install (dev + prod) needed to bundle -----------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/mcp-stdio/package.json apps/mcp-stdio/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/mcp/package.json packages/mcp/package.json
RUN pnpm install --frozen-lockfile

# ---- build: bundle apps/server into dist/main.js + dist/db/migrate.js -----
FROM deps AS build
COPY . .
RUN pnpm --filter @questlog/server build

# ---- prod-deps: apps/server's production dependencies only, standalone ---
FROM base AS prod-deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/mcp/package.json packages/mcp/package.json
RUN pnpm install --prod --frozen-lockfile --filter @questlog/server...

# ---- runtime ----------------------------------------------------------------
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /repo/apps/server/dist ./apps/server/dist
# migrate.ts resolves `migrationsFolder` relative to its own file location
# (import.meta.url), not process.cwd() — cwd-relative broke once this file
# started running from two different working directories (apps/server
# locally via tsx, apps/server/dist in this bundled image). The SQL files
# themselves are never bundled, so they're copied separately, to the same
# offset migrate.ts computes from its own location: sibling "migrations" of
# wherever migrate.js itself ends up (dist/db/migrate.js → dist/db/migrations).
COPY --from=build /repo/packages/core/src/db/migrations ./apps/server/dist/db/migrations

WORKDIR /repo/apps/server
EXPOSE 3000
CMD ["node", "dist/main.js"]
