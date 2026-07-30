# T-093 — Drop TypeScript composite project references in favor of `tsc --noEmit`

**Outcome:** shipped
**Branch:** gates/g-007-drop-typescript-composite-project-references
**Diff:** 14 files changed, 23 insertions(+), 71 deletions(-) (implementation commit; excludes the separate gate-resolution/ticket-drafting commits on the same branch)

## What shipped

Removed `composite: true`, `references` arrays, `outDir`, and `rootDir` from all six package tsconfigs; switched every `typecheck` script (and `apps/web`'s `build` script) from `tsc -b` to `tsc --noEmit`; dropped the now-dead `.typecheck-out` exclude/ignore entries from `apps/mcp-stdio/vitest.config.ts` and `biome.json`. Cross-package imports now resolve entirely through each package's existing `paths` aliases.

## Test evidence

```
$ pnpm typecheck
 Tasks:    6 successful, 6 total
Cached:    0 cached, 6 total
  Time:    4.152s

$ pnpm typecheck   # second run, back-to-back
 Tasks:    6 successful, 6 total
Cached:    6 cached, 6 total
  Time:    106ms >>> FULL TURBO

$ pnpm build
 Tasks:    3 successful, 3 total
Cached:    0 cached, 3 total
  Time:    6.555s

$ pnpm lint
 Tasks:    6 successful, 6 total
Cached:    0 cached, 6 total
  Time:    1.474s

$ pnpm test
@questlog/core:test:  Test Files  27 passed (27) — Tests  239 passed (239)
@questlog/server:test: Test Files  14 passed (14) — Tests  103 passed (103)
@questlog/web:test:  Test Files  46 passed (46) — Tests  262 passed (262)
@questlog/mcp:test:  Test Files  1 passed (1) — Tests  39 passed (39)
 Tasks:    5 successful, 5 total
Cached:    0 cached, 5 total
  Time:    12.859s
```

## Exit condition check

- **All tests/typecheck/lint/build green, pasted output** — see above, all four commands ran clean.
- **`git grep -n "composite\|references" -- '*/tsconfig.json'` shows no remaining hits** — confirmed empty (reviewer independently re-ran this).
- **No `dist/**`/`.typecheck-out/**` produced by `pnpm typecheck`** — confirmed via `find` immediately after a typecheck run: neither path exists anywhere outside `apps/server/dist`/`apps/mcp-stdio/dist`, which are `pnpm build`'s own esbuild output, produced separately.
- **`pnpm typecheck` run twice back-to-back produces identical results** — first run: 6/6 executed, cache miss. Second run: 6/6 cached, full turbo, same pass result — demonstrating the race is now structurally impossible (no shared write target exists at all), not merely avoided by luck.

## Reviewer verdict

**PASS.** Verbatim:

> All six tsconfigs have `composite`, `outDir`, `rootDir`, `references` removed cleanly; `paths` aliases in every file are untouched byte-for-byte relative to before... Out-of-scope items verified untouched: `git diff origin/develop HEAD -- turbo.json apps/server/scripts/build.mjs apps/mcp-stdio/scripts/build.mjs` produced no output... `Docs/IMPLEMENTATION_NOTES.md:134-144` — rewrite is accurate... adds a well-justified WHY note explaining why `rootDir` specifically had to go... The `T-019`-era section... is correctly marked "superseded by T-093" rather than deleted, preserving history without contradicting the current state. No pattern deviation, no scope creep, no test theater, no DRY violation, and comment discipline is good.

## Anything Alex must decide

None. This ticket, its gate (G-007), and the implementation all landed in one interactive session at Alex's direction rather than through the nightly executor — no autonomous judgment calls to flag.

One incidental discovery worth noting: the ticket's own Scope anticipated dropping `outDir`/`rootDir` "where they now serve no purpose," but `rootDir` turned out to be actively harmful, not just inert, once `references` no longer partitions the build into per-package project boundaries (`tsc` single-programs every file reached via a `paths` alias, and `rootDir` then rejects cross-package files with `TS6059`). First pass left `rootDir` in place and `pnpm typecheck` failed immediately across every package with cross-package imports; second pass removed it and everything passed. Documented in `IMPLEMENTATION_NOTES.md`'s rewritten section so a future reader doesn't rediscover this from scratch.
