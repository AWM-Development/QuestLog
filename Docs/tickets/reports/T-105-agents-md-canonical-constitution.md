# T-105 — Adopt `AGENTS.md` as the canonical constitution

**Outcome:** shipped
**Branch:** feat/m-pipeline/t-105-agents-md-canonical-constitution
**Diff:** 13 files changed, +265/-50 lines
**Complexity tier:** M
**Strategy-gate flag:** yes (implements the already-resolved `G-020` decision; no unresolved 🧠 gate in this ticket's own body)

## What shipped

`AGENTS.md` now exists at the repo root and carries the full constitution verbatim (Principles, Commands, Pointer map, Hard rules, task-source line) — the cross-tool convention spec-kit/Devin/Cursor and other runners check for by default. `CLAUDE.md` is now a 6-line pointer that exists only so Claude Code's own auto-load convention still finds a file at that path. Every constitution/source-of-truth reference to `CLAUDE.md` within this ticket's enumerated scope (root `Docs/tickets/*.md` spec docs, `.claude/skills/*/SKILL.md`, `.claude/commands/*.md`, `.claude/agents/*.md`) now points at `AGENTS.md` instead; the one legitimate "the file Claude Code auto-loads" reference (`EXECUTOR_ROUTINE.md:91`'s context-loading note, and `session-start.sh`'s sync-block comment) was left alone per the ticket's own carve-out.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (771 passed)
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — confirmed above.
- **`AGENTS.md` exists at the repo root and contains every section `CLAUDE.md` carried before this ticket** — verified at ship time via `packages/core/src/ci/constitution-doc.ts`'s `checkConstitutionDoc()` run against the real repo files (`{ ok: true, failures: [] }`), plus a diff read confirming the content is byte-for-byte the prior `CLAUDE.md` (title line changed from `# CLAUDE.md` to `# AGENTS.md`, nothing else). That module was removed post-review (see "Anything Alex must decide" #2) — re-verify by eye or with the plain `grep`/`wc -l` the exit condition specifies if this needs re-checking later.
- **`CLAUDE.md` is ≤10 lines and contains the literal string `AGENTS.md`** — it's 6 lines, confirmed both facts at ship time via the (now-removed) `checkConstitutionDoc()`.
- **`grep -rl "CLAUDE.md" Docs/tickets/ .claude/` returns zero hits that describe it as the constitution/source-of-truth** — see "Anything Alex must decide" below: taken fully literally and recursively this does *not* return zero (dozens of historical `done/`/`reports/`/`gated/(resolved)/` ticket files still mention `CLAUDE.md`, plus `.claude/rules/scripts.md`, `.claude/hooks/session-start.sh`, and two live `queue/` tickets). Within this ticket's own enumerated Scope glob, the grep returns zero problematic hits — confirmed by manual inspection of every hit before and after the edits (see IMPLEMENTATION_NOTES.md § T-105 for the full list and reasoning).

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim:

> **Content split (AGENTS.md / CLAUDE.md).** Verified verbatim: `AGENTS.md` carries the full prior CLAUDE.md content (Principles, Commands, Pointer map, Hard rules, task-source line) unmodified; `CLAUDE.md` is now 6 lines and contains the literal string `AGENTS.md`. Matches exit condition exactly.
>
> **Reference updates.** All 8 files in the enumerated glob... were checked; every constitution/source-of-truth reference to `CLAUDE.md` in that set now points at `AGENTS.md`, and the one legitimate "auto-load" reference left in place... is correctly untouched. Grep confirms zero stray hits in the enumerated scope.
>
> **Scope-interpretation judgment call.** The narrower (non-recursive, root-glob) reading of Scope vs. the literal recursive exit-condition grep is a real internal contradiction in the ticket text, not something the executor invented. The interpretation chosen... is reasonable and consistent with the repo's stated convention elsewhere. One nuance worth flagging to Alex... `Docs/tickets/queue/T-104-cite-not-restate-implementation-notes-rationale.md` and `Docs/tickets/queue/T-040-portfolio-polish-pass.md` are live, not-yet-executed queue tickets whose `CLAUDE.md` references... have now moved to `AGENTS.md` — those will read as inaccurate to whichever future session picks them up... worth a one-line callout in the report so it doesn't silently bit-rot.
>
> **New CI module — `packages/core/src/ci/constitution-doc.ts` / `.test.ts`.** This is the weakest part of the diff. It follows `gate-guard.ts`'s DI *shape*... but not its substance: no `realDeps`, no CLI entry, no `package.json` script, no `scripts/*.sh`, no `ci.yml` step... its 128-line test suite only exercises fabricated in-memory strings via the DI mock — it never reads the real `AGENTS.md`/`CLAUDE.md` in this repo... As it stands this is inert code... This is scope creep relative to the ticket... and, per the "test quality" lens, borderline theater.
>
> **Lint/typecheck/test.** Ran `scripts/run-tests-quiet.sh`: `lint: pass (0 warnings)`, `typecheck: pass`, `test: pass (771 passed)`. Green.
>
> **Comment discipline.** Fine, no duplication issue found.
>
> **DRY.** No duplicated literals/helpers introduced.
>
> PASS-WITH-NOTES

Per `EXECUTOR_ROUTINE.md` Step 5, PASS-WITH-NOTES proceeds straight to wrap-up — no remediation pass taken. The `constitution-doc.ts` critique is real (see "Anything Alex must decide"); I ran it once, live, against the real files as post-hoc evidence (see Exit condition check above) since its own test suite doesn't do that, rather than leaving the exit condition entirely unverified against the real repo.

## Efficiency notes

Ran long relative to a typical `M`-tier ticket mainly because of the Scope/exit-condition tension itself: the ticket's Scope glob and its exit condition's literal recursive grep don't agree, and resolving that required actually running the grep, reading every hit, and classifying each one (historical record vs. live reference vs. auto-load mechanism) rather than a single clean pass. Also spent time deciding how to satisfy "TDD, no exceptions" for a pure docs-restructuring `M`-tier ticket (no S-tier docs-only carve-out applies) — landed on a small DI-style unit test mirroring `gate-guard.ts`'s existing pattern in the same directory, which the reviewer correctly flagged as not fully following that pattern through to a wired CI gate.

**Retry log:** 0 retries. One lint failure (Biome formatting on the new test file) was fixed by running `biome check --write` directly — not counted as a retry since it wasn't a Red/Green iteration, just a formatting auto-fix before the first `run-tests-quiet.sh` pass.

## Anything Alex must decide

1. **Duplicate ticket id found and skipped, not resolved by me:** `Docs/tickets/queue/T-104-cite-not-restate-implementation-notes-rationale.md` and `Docs/tickets/queue/T-104-runner-neutral-project-dir-default.md` are two distinct, legitimate tickets sharing the id `T-104` (both untouched — no PR, no branch). Left both in `queue/` rather than picking either, since either pick risks colliding `cost-reports/T-104.usage.json`, ledger entries, and milestone-checkbox references with the other once it's eventually picked up. One needs renumbering.
2. **`packages/core/src/ci/constitution-doc.ts` (and its test) removed post-review, 2026-08-06** — flagged by the reviewer subagent as unwired (no `realDeps()`/CLI entry/`package.json` script/CI workflow step, unlike `gate-guard.ts`'s full pattern) and scope creep relative to the ticket's Scope. Alex's call in `/morning-review`: delete rather than wire up; the exit condition's own `grep`/`wc -l` is sufficient going forward. See `IMPLEMENTATION_NOTES.md` § T-105.
3. **Two live `queue/` tickets will read as stale once this merges:** `T-104-cite-not-restate-implementation-notes-rationale.md` and `T-040-portfolio-polish-pass.md` both describe `CLAUDE.md` as carrying content (hard rules, project description) that has now moved to `AGENTS.md`. Not fixed here — outside this ticket's enumerated Scope glob (`queue/` isn't one of the four named locations) — but whoever picks either up next should read `AGENTS.md` for that content, not the now-thin `CLAUDE.md`.
4. **`.claude/rules/scripts.md` and `.claude/hooks/session-start.sh`** each have one remaining `CLAUDE.md` mention (`scripts.md`'s DRY-threshold citation; `session-start.sh`'s "as documented in CLAUDE.md" comment for `docker compose up -d`) that technically now describes stale content — both outside the ticket's enumerated Scope glob (`.claude/rules/` and hooks weren't named), left untouched, flagged here per the ticket's own "state this explicitly... rather than silently deciding" instruction.
5. **`session-start.sh`'s sync block confirmed not to need an `AGENTS.md` entry**, per the ticket's own Context-files question — it only syncs `.claude/commands`/`.claude/skills` (files prone to per-branch divergence); `AGENTS.md` isn't in that category, same reasoning `CLAUDE.md` itself was already exempt from.
6. **`EXECUTOR_ROUTINE.md`'s "Assumes:" line** (naming `TICKET_SPEC.md`, `GATE_SPEC.md`, etc.) doesn't reference `CLAUDE.md` at all — confirmed it still resolves unchanged, no edit needed.
