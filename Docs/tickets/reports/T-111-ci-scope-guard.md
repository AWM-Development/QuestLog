# T-111 — CI scope guard: diff confined to declared `Context files:`, `Docs/mockups/` untouched, base is `develop`

**Outcome:** shipped
**Branch:** feat/m-pipeline/t-111-ci-scope-guard
**Diff:** 6 files changed, +454/-1 lines
**Complexity tier:** M
**Strategy-gate flag:** yes (provenance only — this ticket's scope became draftable after `G-020`'s Q2 resolution; no unresolved gate was hit during execution)

## What shipped

A new `scope-guard` CI job that, for a ticket-implementation PR (`feat/*` head branch), warns when the diff touches a file outside the ticket's declared `Context files:` and not newly created by the diff, and hard-fails if the diff touches `Docs/mockups/` or targets a base branch other than `develop`.

## Test evidence

```
$ bash scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (776 passed)
```

New suite in isolation:

```
$ npx vitest run src/ci/scope-guard.test.ts
 RUN  v3.2.4 /Users/alexandermeyer/Documents/Code/QuestLog/tmp/worktrees/T-111/packages/core

 ✓ |core| src/ci/scope-guard.test.ts (11 tests) 3ms

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see `run-tests-quiet.sh` output above.
- **A synthetic ticket-implementation PR touching a file outside its ticket's `Context files:` list produces a warning annotation, not a failing check** — `packages/core/src/ci/scope-guard.test.ts:106` ("warns on a changed file outside both the declared Context files: set and the diff's own new files"), asserting `result.ok === true` and `result.warnings` contains the specific path. Same synthetic-deps pattern `gate-guard.test.ts` already uses for its own "synthetic PR" exit-condition checks.
- **A synthetic ticket-implementation PR touching `Docs/mockups/` fails the job** — `scope-guard.test.ts:86` ("hard-fails when the diff touches Docs/mockups/"), asserting `result.ok === false` with a failure message naming the mockups path.
- **A synthetic PR based on a branch other than `develop` fails the job** — `scope-guard.test.ts:66` ("hard-fails when the PR's base branch isn't develop"), asserting `result.ok === false` with a failure message naming the base branch.

## Reviewer verdict

PASS-WITH-NOTES. Verbatim:

> **Correctness / exit condition coverage:** all three exit-condition scenarios (Context-files mismatch → warning only, `Docs/mockups/` touch → hard fail, non-`develop` base → hard fail) have direct unit tests in `packages/core/src/ci/scope-guard.test.ts:66-132`, and they assert on message content, not just `toBeDefined()` — not test theater. `parseContextFiles` is also unit-tested for its edge cases (no header, blank-line stop). Ran the suite locally: 11/11 pass. Lint clean on the new files.
>
> **Pattern conformance:** `scope-guard.ts` correctly follows `.claude/rules/scripts.md` Shape 1 (dual-mode: exported `runScopeGuard` unit-tested, `import.meta.url` guard around the CLI-only bits), matching the explicit reference implementation (`gate-guard.ts`/`ci-gate-guard.sh`) named in the ticket's Context files. `scripts/ci-scope-guard.sh` mirrors `ci-gate-guard.sh`'s thin-wrapper shape correctly.
>
> **Out of scope respected:** mismatch is warn-only, never a failing check (`scope-guard.ts:107-109`); no scope creep into T-115's pre-flight wiring (only referenced in a comment, not implemented).
>
> Two minor notes, neither blocking:
> - `packages/core/src/ci/scope-guard.ts:147-151` duplicates gate-guard.ts's `pnpm --filter` cwd-shift comment almost verbatim rather than trimming to a one-line pointer per CLAUDE.md's comment-discipline rule ("if the same rationale applies at multiple call sites, write it once... and leave a one-line pointer"). It does gesture at gate-guard.ts ("Same class of bug as gate-guard.ts's own note") but restates the full explanation anyway instead of collapsing it.
> - `resolveRepoRoot()`/`realDeps()`/`printResult()` in `scope-guard.ts:116-179` are structurally near-identical to the same functions in `gate-guard.ts:128-177` — this is now the second CI guard job with this exact shape, which is the CLAUDE.md-flagged "extract on the second occurrence" case (a shared `ci/guard-utils.ts` for `resolveRepoRoot`/git-diff-with-cwd-fix/`printResult` would have avoided the copy). `gate-guard.ts` predates this diff so it's borderline whether this ticket "introduced" the duplication, but it was the opportunity to fix it and didn't.
> - `.github/workflows/ci.yml:206` vs `:239` — the "Logic lives in ... unit-tested there; scripts/ci-*.sh is the same reusable entry point T-115's pre-flight wiring will call" sentence is repeated near-verbatim between the gate-guard and scope-guard job comments. Minor, low-value duplication.
>
> Nothing here rises to a functionality gap or scope violation — the "warning" mechanism (`console.warn`, no GitHub `::warning::` workflow-command syntax) doesn't produce a true GitHub Actions UI annotation, but this exactly matches the pre-existing `gate-guard.ts` job's own behavior (`packages/core/src/ci/gate-guard.ts:165-171`), which was accepted as the reference implementation, so it's not a new deviation introduced by this ticket.
>
> PASS-WITH-NOTES

## Efficiency notes

Straightforward M-tier implementation, single TDD pass — wrote the full test suite first (11 cases covering `parseContextFiles` and `runScopeGuard`), confirmed red for the right reason (missing module), then implemented `scope-guard.ts` against `gate-guard.ts`'s established shape and went green on the first pass. One Biome auto-format fixup (`npx biome check --write .`) was needed for two multi-line-formatting nits — not a logic retry.

**Retry log:** 0 retries. 1 `mechanical_lint_typecheck` fixup (Biome formatting auto-fix, not a failure requiring a distinct approach).

## Anything Alex must decide

None blocking. Two follow-up candidates noted in `IMPLEMENTATION_NOTES.md` § T-111 and flagged by the reviewer, left as-is per this ticket's own Scope/Out-of-scope:

1. `gate-guard.ts` and `scope-guard.ts` now share near-identical `resolveRepoRoot()`/`realDeps()`-shape scaffolding — worth extracting to a shared `ci/guard-utils.ts` once a third guard job (`T-112`/`T-113`/`T-114`) makes it a clear rule-of-three, rather than as a drive-by refactor of pre-existing code here.
2. The Context-files-mismatch warning will fire on ordinary wrap-up boilerplate (`CHANGELOG.md`, milestone doc edits) that's virtually never declared in a ticket's `Context files:` list, since it's expected on every ticket regardless of scope. This matches the ticket's literal Exit condition (warn, don't distinguish "expected" from "undeclared"), but is worth watching once this job is live on real PRs — if it's pure noise in practice, a future ticket could special-case the standard wrap-up file set.
