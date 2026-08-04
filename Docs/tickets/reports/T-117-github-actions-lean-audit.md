# T-117 — GitHub Actions lean-ness audit

Audit of all four workflow files ahead of Milestone 1.1's real enforcement
gates. Recommendations only — nothing under `.github/workflows/` is changed
by this ticket.

Files audited: `ci.yml`, `e2e-release-check.yml`, `smoke-test-dev.yml`,
`smoke-test-prod.yml`.

## 1. Cross-workflow duplication

- **`consolidate`** — "Restore Turborepo cache" (`ci.yml` step, `e2e-release-check.yml` step) is byte-identical: same `actions/cache@v5`, same `path: .turbo/cache`, same hash-key expression. Worth extracting to a composite action (e.g. `.github/actions/restore-turbo-cache/action.yml`) so the key expression only exists once. Note: `e2e-release-check.yml`'s own comment already says this step is a no-op there today (`test:e2e` is uncacheable and no cacheable task runs in that workflow) — a shared action wouldn't remove the no-op, just stop the dead key expression from drifting out of sync with `ci.yml`'s copy.
- **`consolidate`** — "Provision and migrate test-tier databases" (`ci.yml`, `e2e-release-check.yml`) is identical line-for-line, and `e2e-release-check.yml`'s own comment says "Mirrors ci.yml." A composite action (e.g. `.github/actions/provision-test-databases/action.yml`) would make that mirroring structural instead of comment-enforced — today a change to one copy has no mechanism forcing the other to follow.
- **`consolidate`** — The checkout → `pnpm/action-setup` → `actions/setup-node` → `pnpm install --frozen-lockfile` preamble repeats near-identically across all four files (differing only in checkout's `ref`/`fetch-depth` on a couple of jobs). A composite action bundling checkout+pnpm+node+install would cut ~4 duplicated steps per workflow to one call each, and would also be the natural place to fix the `@v4`/`@v5` drift in finding #2 once, instead of at four call sites.
- **`consolidate`** — Within `ci.yml` itself (not cross-workflow, but the same duplication pattern), `doc-sync`, `migration-guard`, `mockup-guard`, and `impl-notes-health` are four separate jobs that each independently `checkout@v5` with `fetch-depth: 0` and then independently compute `git diff --name-only origin/${{ github.base_ref }}...HEAD` to get the same `CHANGED` file list. That's four full-history checkouts and four re-derivations of one diff per PR. These could become steps inside a single job that checks out once, computes `CHANGED` once, and runs each pattern check against the shared variable.
- **`consolidate`** — `smoke-test-dev.yml` and `smoke-test-prod.yml` are structurally identical (checkout → pnpm/node/install → poll `/health` → run a smoke script with a scoped `DATABASE_URL`), differing only in `DEV_BASE_URL`/`PROD_BASE_URL`, the secret name, and the smoke-test filter (`smoke:dev` vs `smoke:prod`). A reusable workflow (`workflow_call`) parameterized on base URL / secret name / npm script would remove one of the two nearly-duplicate files.

## 2. Action-version drift

- **`tighten`** — `ci.yml` and `e2e-release-check.yml` pin `actions/checkout@v5`, `pnpm/action-setup@v5`, `actions/setup-node@v5`. `smoke-test-dev.yml` and `smoke-test-prod.yml` still pin `@v4` for the same three actions, with no comment anywhere explaining the divergence. Nothing in either smoke-test workflow's behavior looks like it depends on `v4` specifically — recommend aligning both to `@v5` (or, if there's an undocumented reason they're pinned back, add a comment saying so). This becomes the same fix as the composite action in finding #1's preamble bullet, if that's adopted — one version to bump instead of four.

## 3. Warning-only checks that never fail

- **`tighten`** — `doc-sync` (`ci.yml`) always `exit 0`, including on its own detected violation (only the `echo` differs). As currently written this job can never fail a PR — it's indistinguishable in outcome from not running at all, just noisier in the Checks tab. Before M-1.1 adds real gates on top, worth deciding: either make it a real failing check (with the existing `[skip-doc-check]` escape hatch doing what it already does), or drop the job and rely on human review, since "warns but never blocks" is the exact pattern Alex flagged.
- **`tighten`** — `impl-notes-health`'s two steps ("Check IMPLEMENTATION_NOTES.md size", "Check write obligation for sensitive file changes") are both advisory-only (the first literally cannot fail — there's no `exit 1` branch in it at all; the second's only `exit 1`-shaped path is skipped via `[skip-impl-notes]`, otherwise it warns and exits 0). Same question as `doc-sync`: does this pull its weight as two separate steps in a dedicated job, or should it collapse into one step (they already share the same `CHANGED` computation logic that finding #1 flags for cross-job dedup) and/or move from "warning" to "real gate" now that M-1.1 is bringing enforcement.
- **`keep`** — `migration-guard` and `mockup-guard` already hard-fail (`exit 1`) on their violation path with no warning-only branch — these are real gates today, not part of the "never fails" problem. No change recommended.

## 4. Per-job overhead in `ci.yml`'s `pr` job

- **`tighten`** — The "Check for test.only / test.skip" guard runs *after* Lint, Typecheck, and Build, even though it's a plain `grep` over the checked-out source and needs none of `pnpm install`'s output. Moving it immediately after checkout (before install) would fail a PR containing a stray `.only`/`.skip` in seconds instead of after paying for install + lint + typecheck + build first.
- **`consolidate`** (tradeoff, not a clear win — flagging for Alex's call) — Lint → Typecheck → Build → Test currently run serially in one job. Splitting them into separate parallel jobs would cut wall-clock time on a passing PR, but each job would need its own checkout + install (or a shared artifact/cache handoff), trading serial compute time for duplicated setup overhead and more total billed minutes. Given the existing Turborepo cache already makes repeat Lint/Typecheck/Build fast on unchanged inputs, the wall-clock win from parallelizing is likely smaller than it looks at first glance — recommend leaving this serial unless a future measurement shows the setup/parallelize tradeoff actually pays off.
- **`keep`** — Build does not look redundant with Typecheck: `pnpm turbo typecheck` is `tsc -b` (type errors only, no output), while `pnpm turbo build` produces the actual bundled output consumed downstream (e.g. by `apps/mcp-stdio`'s Docker substitute path in the executor routine). Different jobs, not duplicated work.

## 5. General sprawl

- **`remove`** — `e2e-release-check.yml`'s "Restore Turborepo cache" step is a documented no-op today (its own comment says so — no cacheable task runs in this workflow). Recommend dropping it until a future change actually adds a cacheable task here, rather than keeping a step that provides zero benefit for the sake of looking structurally parallel to `ci.yml`.
- **`consolidate`** — `actionlint`'s job (`ci.yml`) re-downloads the `actionlint` binary via a raw `curl | bash` script on every run instead of using a pinned, cached marketplace action (e.g. `reviewdog/action-actionlint` or similar) or caching the downloaded binary. Low cost today (single small binary), but it's an uncached network fetch on every run and a `curl | bash` pattern that's worth tightening independent of speed, given it's pulling and executing a script from an external repo on every CI run.
- **`keep`** — `pnpm/action-setup`'s implicit pnpm-store cache (via `actions/setup-node`'s `cache: pnpm`) and the explicit Turborepo cache step serve different layers (package-manager download cache vs. task-output cache) — this is not a duplicate caching mechanism, no finding here.

## Summary punch list

| # | Item | Tag |
|---|------|-----|
| 1 | Turborepo cache step duplicated (`ci.yml` / `e2e-release-check.yml`) | consolidate |
| 2 | DB provisioning step duplicated (`ci.yml` / `e2e-release-check.yml`) | consolidate |
| 3 | Checkout/pnpm/node/install preamble duplicated across all 4 files | consolidate |
| 4 | `doc-sync`/`migration-guard`/`mockup-guard`/`impl-notes-health` each re-checkout + re-diff independently | consolidate |
| 5 | `smoke-test-dev.yml` / `smoke-test-prod.yml` near-duplicate files | consolidate |
| 6 | `@v4` vs `@v5` action-version drift, undocumented | tighten |
| 7 | `doc-sync` never actually fails | tighten |
| 8 | `impl-notes-health`'s two checks are advisory-only | tighten |
| 9 | `migration-guard` / `mockup-guard` already real gates | keep |
| 10 | test.only/skip guard runs late in the `pr` job | tighten |
| 11 | Lint/Typecheck/Build serial vs. parallel jobs | consolidate (tradeoff — Alex's call) |
| 12 | Build vs. Typecheck overlap | keep (not actually redundant) |
| 13 | `e2e-release-check.yml`'s cache step is a documented no-op | remove |
| 14 | `actionlint` job uses uncached `curl \| bash` install | consolidate |
| 15 | pnpm-store cache vs. Turborepo cache | keep (different layers, not duplicated) |
