# T-120 — Extract shared composite actions for ci.yml / e2e-release-check.yml setup steps

**Outcome:** shipped
**Branch:** feat/m-efficiency/t-120-ci-composite-actions
**Diff:** 5 files changed, +98/-115 lines (.github/ only; plus the ticket file move)
**Complexity tier:** M
**Strategy-gate flag:** no

## What shipped

Three new composite actions under `.github/actions/` — `setup-repo` (checkout + pnpm + Node + `pnpm install --frozen-lockfile`), `restore-turbo-cache` (the `.turbo/cache` restore step), and `provision-test-databases` (test-tier DB provisioning/migration) — replace the duplicated inline step sequences T-117's audit flagged (findings #1–#3) across five call sites in `ci.yml` and `e2e-release-check.yml`. No behavior change: byte-for-byte equivalent to what ran before.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (802 passed)
```
(`scripts/run-tests-quiet.sh`, full output above — this ticket touches no application code, so this run is a regression check, not new coverage.)

`actionlint` (repo-wide, auto-discovers local composite actions referenced via `uses: ./...`):
```
$ actionlint
$ echo "exit: $?"
exit: 0
```

## Exit condition check

- `.github/actions/setup-repo/action.yml`, `.github/actions/restore-turbo-cache/action.yml`, `.github/actions/provision-test-databases/action.yml` all exist — confirmed, `git status`/`ls .github/actions/`.
- `grep -c "uses: ./.github/actions/setup-repo" .github/workflows/ci.yml .github/workflows/e2e-release-check.yml` → `4` and `1` respectively (≥1 per file). Same check for `restore-turbo-cache` (`1`/`1`) and `provision-test-databases` (`1`/`1`).
- Zero remaining inline `actions/checkout@v5` + `pnpm/action-setup@v5` + `actions/setup-node@v5` + `pnpm install --frozen-lockfile` sequences outside the new composite actions — confirmed via `grep -rn "pnpm/action-setup@v5"` / `grep -rn "pnpm install --frozen-lockfile"` against `.github/workflows/`: only hits are `smoke-test-dev.yml`/`smoke-test-prod.yml`, explicitly out of scope (T-123's job).
- A real PR run of both workflows completes lint/typecheck/build/test and the e2e check exactly as before, no new failures: `act`/Docker aren't available in this sandbox (known constraint, `Docs/IMPLEMENTATION_NOTES.md` § docker), so this is deferred to the actual PR's live CI run opened by this same wrap-up — the stated fallback path when a local dry-run isn't practical. `actionlint` (above) is the pre-merge static check that both files remain syntactically/structurally valid composite-action call sites.
- All tests green, typecheck clean, lint clean — see Test evidence above.

## Reviewer verdict

PASS — reviewer subagent output:

> Full diff is scoped tightly to `.github/` plus the ticket file move (no premature checkbox/report changes — appropriate for a pre-review state). No scope creep.
>
> I checked exit-condition grep counts, verified byte-identical extraction of the three composite actions against the original inline steps, confirmed the `setup-repo` action's `ref`/`fetch-depth` input defaults exactly reproduce `actions/checkout@v5`'s own runtime defaults (empty ref = same as unset per checkout's `core.getInput` semantics; `fetch-depth: "1"` matches checkout's own default), confirmed no step reordering in either workflow, confirmed the `doc-sync`/`migration-guard`/`mockup-guard`/`impl-notes-health` jobs' lone `checkout@v5` steps (no pnpm/node/install) were correctly left untouched per Out-of-scope, and confirmed the duplicated rationale comments (turbo-cache restore-keys reasoning, DB template-clone connection-close reasoning) were consolidated into a single copy in each new `action.yml` rather than left duplicated across both workflow files as before — good deduplication, not new sprawl.
>
> No rules file exists specifically for `.github/` workflow conventions to check against. No test files are part of this diff (none expected — GH Actions composite actions aren't unit-testable in this repo's stack), so no test-theater concern applies. Definition-of-done bookkeeping (milestone checkbox, CHANGELOG, IMPLEMENTATION_NOTES, report) is correctly absent, as expected pre-review.
>
> PASS

## Efficiency notes

Straightforward, single-pass mechanical extraction — no retries needed. The only judgment calls were (1) figuring out which call sites actually share the full checkout+pnpm+node+install shape (`doc-sync`/`migration-guard`/`mockup-guard`/`impl-notes-health` only checkout, correctly excluded) and (2) choosing `setup-repo`'s `ref`/`fetch-depth` input defaults to exactly match `actions/checkout@v5`'s own defaults so the four call sites that don't pass either input keep identical behavior. `act` wasn't available for a local dry-run, so verification relied on `actionlint` (repo-wide, validates the composite-action references resolve and are structurally sound) plus the existing `scripts/run-tests-quiet.sh` regression gate; the exit condition's own fallback language anticipated exactly this and defers the live-run proof to the real PR.

**Retry log:** 0 retries.

## Anything Alex must decide

None. One scope note for awareness: T-117 finding #13 recommends dropping `e2e-release-check.yml`'s Turbo-cache step entirely (it's a documented no-op there). This ticket deliberately preserved it as a `restore-turbo-cache` call, per its own "byte-for-byte, no behavior change" scope — removing it would be a legitimate but separate follow-up, not folded in here as a drive-by.
