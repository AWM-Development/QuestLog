# T-093 — Drop TypeScript composite project references in favor of `tsc --noEmit`

Milestone ref: none — pipeline/tooling hygiene, same category as T-027/T-043/
T-052, not tied to a milestone checkbox. Resolves G-007
(`Docs/tickets/gated/resolved/G-007-drop-typescript-composite-project-references.md`).

Branch: chore/pipeline/t-093-drop-typescript-composite-project-references

Context files (load ONLY these):
  - tsconfig.base.json
  - packages/shared/tsconfig.json, packages/core/tsconfig.json,
    packages/mcp/tsconfig.json, apps/server/tsconfig.json,
    apps/mcp-stdio/tsconfig.json, apps/web/tsconfig.json
  - packages/shared/package.json, packages/core/package.json,
    packages/mcp/package.json, apps/server/package.json,
    apps/mcp-stdio/package.json, apps/web/package.json (each package's
    `typecheck`/`build` script)
  - apps/mcp-stdio/vitest.config.ts (the `.typecheck-out` exclude entry — the
    gate stub's own Notes misnamed this as `packages/mcp/vitest.config.ts`;
    the real file living at this path is the one to edit)
  - biome.json (the `.typecheck-out` ignore entry)
  - turbo.json (the `typecheck` task — confirm it still needs no `dependsOn`
    once nothing emits)
  - Docs/IMPLEMENTATION_NOTES.md:134-136 ("TypeScript project references —
    rules for cross-package imports" — the stale TS6310 claim this ticket
    corrects) and the `apps/mcp-stdio` `.typecheck-out` clobber note (§ "T-019")
  - Docs/tickets/gated/resolved/G-007-drop-typescript-composite-project-references.md
    (the resolution and full rationale — do not re-litigate the decision,
    just implement it)

Mockup: none

Model: sonnet

Scope:
  Remove `composite: true` and the `references` arrays from all six
  tsconfigs (`packages/shared`, `packages/core`, `packages/mcp`,
  `apps/server`, `apps/mcp-stdio`, `apps/web`), keeping each package's
  existing `paths` aliases (those already do the cross-package resolution;
  `references` was purely for `tsc -b`'s build-ordering/emit, not for making
  imports resolve). Drop `outDir`/`rootDir` where they now serve no purpose
  (no emit happens under `--noEmit`) — this includes removing
  `apps/mcp-stdio/tsconfig.json`'s `.typecheck-out` `outDir` and its
  accompanying comment, since the clobber bug it worked around no longer
  exists once nothing emits.

  Update every package's `typecheck` script from `tsc -b` to `tsc --noEmit`
  (`packages/core`, `packages/mcp`, `apps/server`, `apps/mcp-stdio`;
  `packages/shared`'s is already `tsc --noEmit` — just drop its now-unused
  `composite: true`). Update `apps/web/package.json`'s `build` script from
  `tsc -b && vite build` to `tsc --noEmit && vite build`.

  Remove the now-dead `.typecheck-out` exclude entry from
  `apps/mcp-stdio/vitest.config.ts` and the `.typecheck-out` ignore entry
  from `biome.json` — nothing writes to that directory anymore.

  Rewrite `Docs/IMPLEMENTATION_NOTES.md`'s "TypeScript project references"
  note to describe the new reality (plain `tsc --noEmit` per package via
  `paths` aliases, no emit, no `references`) and correct the stale claim
  that `tsc --noEmit` is incompatible with `composite: true` (TS6310) — it
  no longer applies once `composite` itself is gone, and was already
  empirically false before this ticket (`packages/shared` ran exactly that
  combination). Fold in a one-line pointer that this also structurally
  eliminates the PR #95 torn-`.d.ts` race and the `apps/server`
  `outDir`/esbuild clobber bug (no separate `.typecheck-out` treatment
  needed for `apps/server`, unlike what keeping composite would have
  required).

Out of scope:
  - `turbo.json`'s `test` task `dependsOn` — that's T-069–T-072/G-008
    territory (per-package test databases), unrelated to this ticket's
    `typecheck` task change. Do not touch it.
  - Any change to `apps/server/scripts/build.mjs` or
    `apps/mcp-stdio/scripts/build.mjs` (esbuild bundling) — unaffected by
    this change, since neither ever consumed `tsc -b`'s emitted output.
  - Renaming or restructuring any package directory.
  - Adding `dependsOn`/`outputs` to the `typecheck` turbo task — moot once
    nothing emits, and not what this ticket is resolving.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean, build clean — pasted
    output, not a summary, for `pnpm typecheck`, `pnpm build`, `pnpm lint`,
    `pnpm test`
  - `git grep -n "composite\|references" -- '*/tsconfig.json'` (or
    equivalent) shows no remaining `composite: true` or `references` array
    in any of the six package tsconfigs
  - no `dist/**` or `.typecheck-out/**` directory is produced by
    `pnpm typecheck` (confirm by running it and checking neither path
    exists afterward, only whatever `pnpm build`'s esbuild step separately
    produces under `apps/server/dist` / `apps/mcp-stdio/dist`)
  - running `pnpm typecheck` twice back-to-back with no intervening clean
    produces identical pass/fail results both times (demonstrates the
    former concurrent-emit race, per PR #95, is now structurally
    impossible rather than merely avoided)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: no milestone checkbox to flip (see Milestone
  ref above), `IMPLEMENTATION_NOTES.md` updated per Scope above, a
  `CHANGELOG.md` entry under `[Unreleased]` (tooling/dev-experience
  section), morning report written.
