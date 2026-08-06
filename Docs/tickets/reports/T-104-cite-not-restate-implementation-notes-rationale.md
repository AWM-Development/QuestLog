# T-104 — Cite-not-restate rule for IMPLEMENTATION_NOTES.md rationale

**Outcome:** shipped
**Branch:** chore/m-pipeline/t-104-cite-not-restate-implementation-notes-rationale
**Diff:** 4 files changed, +14/-1 lines (AGENTS.md, .claude/agents/reviewer.md, Docs/IMPLEMENTATION_NOTES.md, CHANGELOG.md)
**Complexity tier:** D
**Strategy-gate flag:** yes (already resolved — this ticket implements G-013's resolution; no unresolved 🧠 gate encountered)

## What shipped

`AGENTS.md` and `.claude/agents/reviewer.md` now carry an explicit cite-not-restate rule: once a piece of rationale is captured in full in `Docs/IMPLEMENTATION_NOTES.md`, rule files, code comments, and future ticket files must cite it with a one-line pointer instead of restating it in full — with tickets/reports/`done/`/`archive/` staying exempt as point-in-time records. `reviewer.md` check 6 now explicitly flags this even at a single call site, not just duplication within one diff.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (765 passed)
```
(`scripts/run-tests-quiet.sh`, single end-of-work pass per the D-tier Step 4 path — no application code touched, so no per-checkpoint Red/Green/Refactor.)

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see Test evidence above.
- **`AGENTS.md` contains an explicit cite-not-restate rule scoped to rule files, code comments, and future tickets, with tickets/reports named as the exemption** — new bullet "Cite, don't restate." directly beside the existing "Comments: WHY only, once." bullet (`AGENTS.md`). Edited `AGENTS.md`, not `CLAUDE.md` as the ticket's Context files list names — `T-105` (shipped same day) already moved this bullet's real text to `AGENTS.md` and reduced `CLAUDE.md` to a 6-line pointer; `T-105`'s own report flagged this exact ticket by name as one of two live queue tickets still describing `CLAUDE.md` as carrying content that had moved. See `Docs/IMPLEMENTATION_NOTES.md` § T-104 for the one-line pointer to this deviation (cited, not restated, per the very rule this ticket adds).
- **`.claude/agents/reviewer.md` check 6's text explicitly covers restatement of `Docs/IMPLEMENTATION_NOTES.md` rationale outside the current diff (not just duplication within it), in a code comment, rule file, or new ticket** — check 6's added sentence: "also flag a code comment, `.claude/rules/*.md` addition, or new ticket file that restates rationale already captured in full in `Docs/IMPLEMENTATION_NOTES.md`, even at a single call site with no other copy in the diff (`G-013`)."
- **A worked example demonstrates check 6 would now catch the original `trustProxy`-shaped case** — `Docs/IMPLEMENTATION_NOTES.md`'s existing T-034 entry (§ "OAuth discovery advertised `http://` behind Fly's TLS-terminating proxy") already has the full explanation on record. A hypothetical future diff adding, at a single call site, a code comment like:
  ```ts
  // Fly terminates TLS at its edge and forwards plain HTTP internally, so
  // request.protocol reflects the internal scheme unless trustProxy is set...
  ```
  has only one copy in that diff — pre-T-104, check 6's "more than one call site in this diff" trigger would not fire on it (that's exactly how the real incident reached three files: `IMPLEMENTATION_NOTES.md`, `server.ts`, and a test file, across separate sessions, never more than one new copy per diff). Post-T-104, check 6 now flags it directly: the rationale is already captured in full in `IMPLEMENTATION_NOTES.md` § T-034, so a comment restating it — even alone in the diff — should instead read `// Fastify's trustProxy option handles this — see IMPLEMENTATION_NOTES.md § T-034.`

## Reviewer verdict

N/A — D tier; independent verification deferred to Alex's manual /morning-review.

## Efficiency notes

Straightforward docs-only ticket. The one snag: the ticket's own Context files list pointed at `CLAUDE.md` for the bullet to extend, but that content had already relocated to `AGENTS.md` by `T-105` (merged the same day, ahead of this run) — caught by reading `AGENTS.md`/`CLAUDE.md` directly in Step 3 rather than trusting the ticket's file list blindly, and confirmed against `T-105`'s own `IMPLEMENTATION_NOTES.md` entry, which had already flagged this exact ticket by name as needing the update.

Also surfaced, unrelated to this ticket's own work: `Docs/tickets/queue/` currently has **two separate ticket files both titled `T-104`** — `T-104-cite-not-restate-implementation-notes-rationale.md` (this one) and `T-104-runner-neutral-project-dir-default.md` (a distinct M-PIPELINE.8 ticket, still in `queue/`, untouched). A genuine ticket-numbering collision from the ticket-writer pipeline, not something this ticket's scope covers — flagged under "Anything Alex must decide" below rather than fixed as a drive-by.

**Retry log:** 0 retries.

## Anything Alex must decide

- **Duplicate ticket id `T-104`.** Two distinct ticket files in `Docs/tickets/queue/` are both numbered `T-104`: this one (now shipped, moved to `done/`) and `T-104-runner-neutral-project-dir-default.md` (still queued, `M-PIPELINE.8`, `feat/m-pipeline/t-104-runner-neutral-project-dir-default`, untouched by this run). The queue/backlog pipeline has no collision check today. Suggest the other file gets renumbered to the next free `T-###` before it's picked up, to avoid two branches/PRs/reports both claiming id `T-104`.
- No unresolved 🧠 gate encountered — `G-013` (this ticket's own source gate) was already fully resolved before this run started.
- No milestone checkbox flipped: the ticket's own Milestone ref explicitly frames this as a process-discipline gap resolved via `/ungate` (`G-013`), not an unticketed `M-AUDIT.1` task in its own right — `M-AUDIT.1`'s own scope is unaffected and stays as-is, per the ticket's own framing.
