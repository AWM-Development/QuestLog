# G-007 — Drop TypeScript composite project references in favor of `tsc --noEmit`

Gate type: 🧠 strategy

Milestone ref: none — pipeline/tooling hygiene, same category as T-027/T-043/T-052; surfaced by a 2026-07-26 standalone test-infrastructure audit, not tied to a milestone task

Opened: 2026-07-26 — by Alex/agent during a standalone test-infrastructure audit (not tied to ticket execution)

Context files (load ONLY these):
  - tsconfig.base.json
  - packages/shared/tsconfig.json, packages/core/tsconfig.json, packages/mcp/tsconfig.json, apps/server/tsconfig.json, apps/mcp-stdio/tsconfig.json, apps/web/tsconfig.json
  - turbo.json (the `typecheck` task — no `dependsOn`, no `outputs`)
  - apps/server/scripts/build.mjs, apps/mcp-stdio/scripts/build.mjs
  - packages/shared/package.json, packages/core/package.json, packages/mcp/package.json (`main`/`exports` fields — all point at `./src/index.ts`, not `dist/`)
  - Docs/IMPLEMENTATION_NOTES.md:239-240 ("TypeScript project references — rules for cross-package imports")
  - PR #95 (`chore(T-052)...`) CI run https://github.com/AWM-Development/QuestLog/actions/runs/30212942223/job/89822142597 — live evidence, not part of this ticket's own diff

Open question: Should the repo drop `composite: true` / TS project `references` across all six tsconfigs in favor of plain `tsc --noEmit` against the existing `paths` aliases — given that no runtime or build consumer actually reads any package's emitted `dist/**`/`.typecheck-out/**` output (every package's `package.json` `exports` points at `./src/index.ts`; `apps/server` and `apps/mcp-stdio` bundle straight from `.ts` source via esbuild; Vite/Vitest resolve `.ts` source directly; the only consumer of any package's `tsc -b` emit is another package's own `tsc -b`) — or is there a reason to keep composite-project emit that this audit didn't surface, worth surfacing before removing it?

Blocks: none yet — resolution rewrites `tsconfig.base.json` plus all six package tsconfigs, `apps/web`'s `build` script (`tsc -b && vite build` → `tsc --noEmit && vite build`), `packages/mcp/vitest.config.ts`'s `.typecheck-out` exclude, `biome.json`'s `.typecheck-out` ignore entry, and the now-stale claim at `Docs/IMPLEMENTATION_NOTES.md:240` (that `tsc --noEmit` is incompatible with `composite`, i.e. TS6310 — no longer true against the TypeScript version currently in use, confirmed empirically: `packages/shared/package.json`'s `typecheck` script is already `tsc --noEmit` against a `composite: true` config and passes clean). No ticket or milestone task is currently blocked on this — it's forward-looking pipeline hygiene, not an in-flight dependency.

Notes: Concrete, not hypothetical — PR #95 (T-052, in progress) hit exactly this failure live: `packages/mcp#typecheck` failed with `error TS2306: File '.../packages/core/dist/services/embedding.service.d.ts' is not a module`, even though T-052's diff never touches `embedding.service.ts`, `turbo.json`, or any tsconfig. Root cause: `turbo.json`'s `typecheck` task has no `dependsOn` between packages, so `packages/core#typecheck` and `packages/mcp#typecheck` raced to write/read `packages/core/dist/` concurrently, producing a torn `.d.ts`.

Also surfaced: the obvious alternative fix — adding `dependsOn: ["^typecheck"]` — is insufficient on its own, for three separate reasons: (1) `apps/web/package.json` and `apps/mcp-stdio/package.json` don't declare `@questlog/server` as a workspace dependency despite both carrying a TS project reference to it, so turbo's dependency-graph-derived ordering wouldn't cover that edge; (2) `packages/shared`'s `typecheck` script is already `tsc --noEmit` (emits nothing), so any downstream package waiting on it would still find nothing to reuse and rebuild `packages/shared`'s composite output itself, concurrently with siblings doing the same; (3) `typecheck` declares no `outputs`, so a turbo cache hit replays log output without restoring `dist/`, and every downstream sibling would still see the upstream project as "needs building" and race to build it. Making `dependsOn` actually close the race requires four separate coordinated fixes to preserve emitted output that nothing outside `tsc -b` itself consumes — that complexity is itself an argument for removing the emit rather than patching around it, but it's Alex's call, not an automatic one.

`apps/server/tsconfig.json` also currently has `outDir: "./dist"`, the same directory `apps/server/scripts/build.mjs`'s esbuild step writes the real deployable bundle to — the identical clobber bug T-019 already found and fixed for `apps/mcp-stdio` (via a separate `.typecheck-out` directory, `Docs/IMPLEMENTATION_NOTES.md` §T-019) is live and unfixed in `apps/server` today. Dropping composite/emit entirely removes this for free; keeping composite would need the same `.typecheck-out` treatment applied to `apps/server` as a separate, smaller fix regardless of how this gate resolves.
