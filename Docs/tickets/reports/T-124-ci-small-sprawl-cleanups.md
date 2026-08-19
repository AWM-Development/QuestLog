# T-124 — Small CI sprawl cleanups: guard ordering, dead cache step, actionlint install

**Outcome:** shipped
**Branch:** feat/m-efficiency/t-124-ci-small-sprawl-cleanups
**Diff:** 2 files changed, +24/-20 lines
**Complexity tier:** S
**Strategy-gate flag:** no

## What shipped

Three independent, low-risk CI cleanups from T-117's audit (findings #10, #13,
#14): `ci.yml`'s `pr` job now runs the "no `test.only`/`test.skip`" guard
immediately after checkout, before install/Lint/Typecheck/Build, so a stray
`.only`/`.skip` fails fast instead of after paying for the full setup and
three quality gates; `e2e-release-check.yml`'s documented no-op "Restore
Turborepo cache" step is removed; `ci.yml`'s `actionlint` job no longer
fetches its install script from `actionlint`'s `main` branch via
`curl | bash` — both the script's own ref and the binary version it
downloads are now pinned to release tag `v1.7.12`, preserving the existing
`-color` invocation.

This is a config-only change (S-tier, no application code touched), so it
skipped the Red/Green/Refactor TDD loop per `EXECUTOR_ROUTINE.md` Step 4's
docs/config-only branch — made the documented change directly, then ran the
end-of-work verification pass below.

## Test evidence

Pinned `actionlint` binary (v1.7.12) against the changed workflow files:

```
$ bash <(curl -s https://raw.githubusercontent.com/rhysd/actionlint/v1.7.12/scripts/download-actionlint.bash) 1.7.12
Downloaded and unarchived executable: .../actionlint
Done: 1.7.12

$ ./actionlint -color
exit: 0
```

Repo's standard lint/typecheck/test chain:

```
$ scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (836 passed)
```

## Exit condition check

- `ci.yml`'s "Check for test.only / test.skip" step appears before Lint/Typecheck/Build in the `pr` job's step order — verified by inspection (`ci.yml:39-56`, guard runs right after the bare `actions/checkout@v5`, before `setup-repo`/`restore-turbo-cache`/Lint/Typecheck/Build).
- `e2e-release-check.yml` contains zero "Restore Turborepo cache" steps — verified by inspection (`.github/actions/restore-turbo-cache` reference and its justifying comment both removed).
- `ci.yml`'s `actionlint` job contains no `curl | bash` pattern reaching an unpinned ref; it installs actionlint via a pinned-version URL (`v1.7.12` tag, explicit `1.7.12` version arg) — verified by inspection (`ci.yml:392-403`).
- A real execution of `actionlint` against both changed workflow files completed with the same pass/fail outcome as before this change (clean, exit 0) — see Test evidence above; the guard-ordering and cache-step changes are pure step reordering/removal with no behavioral change to the underlying grep/DB-provisioning logic, so their pass/fail outcome on an unmodified fixture PR is unchanged by construction.
- All tests green, typecheck clean, lint clean — see Test evidence above.

## Reviewer verdict

PASS

> Actionlint runs clean with no output (no findings). All three scope items delivered precisely, out-of-scope items respected, comments are appropriately terse with durable WHY citations to the audit report (not restating IMPLEMENTATION_NOTES.md content), and this is genuinely config-only with no code paths to trace for correctness risk beyond straightforward YAML reordering.
>
> Findings: none rising to concern level.
>
> - `.github/workflows/ci.yml:39-52` — guard moved correctly to right after bare checkout, before `setup-repo`/Lint/Typecheck/Build, matching Scope item 1 exactly.
> - `.github/workflows/e2e-release-check.yml:63-69` (pre-diff) — dead cache step and its no-op-justifying comment both removed cleanly, matching Scope item 2.
> - `.github/workflows/ci.yml:392-399` — `curl | bash` replaced with a version-pinned fetch (`v1.7.12` tag + explicit `1.7.12` arg to the script), preserving the `-color` invocation; verified the pinned URL resolves (HTTP 200) and `actionlint -color` runs clean against both changed workflow files.
> - T-153 file rename (`Docs/tickets/backlog/T-153-...md` → `queue/`) is documented, in-routine housekeeping (`Docs/tickets/EXECUTOR_ROUTINE.md` Step 1/line 112), not scope creep by this ticket.

## Efficiency notes

Straightforward — three well-scoped, independent config edits with precedent already established by T-117's own audit findings. The only judgment call was how to interpret "before pnpm install" for item 1 given `setup-repo` is a single composite action bundling checkout+install: resolved by inserting the guard between the existing bare `actions/checkout@v5` (already present for local-composite-action resolution) and `setup-repo`, which achieves "runs before install" exactly without splitting the composite action. Verified the pinned actionlint URL/version resolves and lints clean before committing, rather than trusting the tag existed.

**Retry log:** 0 retries.

## Anything Alex must decide

None. One incidental note: this run's Step 1 pre-flight also promoted `T-153` from `backlog/` to `queue/` (its blocker `T-109` had merged) as part of routine housekeeping — unrelated to this ticket's own scope, called out here only because the reviewer's diff included that file move.
