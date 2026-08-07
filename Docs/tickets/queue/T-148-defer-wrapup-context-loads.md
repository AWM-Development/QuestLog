# T-148 — Defer wrap-up-only Context files to the step that actually uses them

**Renumbered twice.** Originally `T-142`, which had already been
independently claimed by
`Docs/tickets/queue/T-142-inventory-wealth-schema-pc-entity-type.md`
(M-INVENTORY.1, `Docs/milestones/MILESTONES_V1_5_MCP.md`, committed
~9 minutes earlier the same day) — moved to `T-146` on 2026-08-07 during
a `/T-145` file-org milestone-docs audit, same class as the
`T-127`→`T-130`/`T-126`→`T-128` renumberings. That fix was never pushed
before a separate concurrent session independently claimed `T-146` for
`Docs/tickets/queue/T-146-lineup-milestone-progress-deployed-version.md`
on `origin/develop` — a second real collision, caught by re-scanning
`origin/develop` before drafting `T-128` in the same session. Moved again
to `T-148` (confirmed free against `origin/develop`, highest ticket at
the time was `T-147`).

Milestone ref: M-EFFICIENCY.20 (`Docs/milestones/MILESTONES_V1_2_MCP.md`)

Complexity tier: D

Strategy-gate flag: no

Priority: P2

Branch: feat/m-efficiency/t-148-defer-wrapup-context-loads

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md § Step 3 (the "Every other tier" bullet list), § Step 6 (the `BLOCKED_TEMPLATE.md` bullet), § Step 7 (the `REPORT_TEMPLATE.md` bullet) — the only file this ticket edits

## Relevant background
excerpted from T-112's own execution and a follow-up conversation with Alex, as of 2026-08-07

T-112's ticket named `Docs/tickets/REPORT_TEMPLATE.md` and `Docs/tickets/BLOCKED_TEMPLATE.md` in its `Context files:` list. Step 3 batch-reads the entire `Context files:` list upfront, so both were read on turn ~3 of a 142-turn run — but `REPORT_TEMPLATE.md` is only ever consulted once, immediately before Step 7 writes the report, and `BLOCKED_TEMPLATE.md` is only ever consulted if the ticket actually hits Step 6 (most shipped tickets never do). Because prompt caching resends the full accumulated conversation on every subsequent turn, content read early but used late pays a "resend tax" proportional to how many turns separate the read from the use — roughly 130 turns' worth for these two files on T-112's run, out of a 14.47M-token `cache_read_input_tokens` total (`Docs/tickets/cost-reports/T-112.usage.json`). Both files are structural constants (the same two files, verbatim, on every M/S/L-tier ticket's `Context files:` list) rather than ticket-specific reads, so the fix doesn't need per-ticket annotation — it's a blanket rule at the two step boundaries that actually consume them.

**On "removing" `BLOCKED_TEMPLATE.md` from context after Step 6 instead of just deferring its read (a question Alex raised while scoping this ticket): not attempted, and not needed.** Two independent reasons: (1) there is no supported mechanism to evict already-read content from an in-progress Claude Code conversation — context is append-only — so "remove after use" isn't an available lever regardless of whether it would help; (2) even if it were available, it wouldn't buy anything here, because Step 6 is already the routine's last step on the blocked path (its final bullet is "Output the blocked report as your summary. Stop — do not proceed to Step 7") — the session ends within a few turns of reading the template, so there's no long remaining tail for that content to keep costing rent on. Deferring the read to the point of first use already captures the entire achievable benefit for this file; this ticket's Scope is deferral only.

Mockup: none

Model: sonnet

Scope: Amend three places in `Docs/tickets/EXECUTOR_ROUTINE.md`:

1. **Step 3** — the "Every other tier" bullet currently reads:
   ```
   - Read `AGENTS.md` (always — it's the canonical constitution, ~40 lines;
     `CLAUDE.md` itself is just a thin pointer to it, per T-105) together
     with every file listed in the ticket's `Context files:` field, as
     parallel tool calls within a single assistant turn — the full list is
     known upfront, so there's no reason to spread these reads
     sequentially across multiple turns, each re-sending the growing
     conversation. Read nothing else, unless you discover mid-ticket that
     something is missing — if so, note that as a scoping gap in the
     eventual report rather than silently pulling in extra files.
   ```
   Add a carve-out (as a new sentence in this same bullet, not a separate
   bullet) excluding `Docs/tickets/REPORT_TEMPLATE.md` and
   `Docs/tickets/BLOCKED_TEMPLATE.md` from this batch read whenever either
   appears in the ticket's `Context files:` list — e.g. "Skip
   `Docs/tickets/REPORT_TEMPLATE.md`/`Docs/tickets/BLOCKED_TEMPLATE.md`
   here even if the ticket names them — Step 7/Step 6 read them
   immediately before use instead (T-148), since both are structural
   constants read once per run, not ticket-specific context."

2. **Step 6** — currently opens directly with:
   ```
   - Fill out `Docs/tickets/BLOCKED_TEMPLATE.md` for this ticket: what
     failed, the distinct approaches attempted with evidence, your
     hypothesis, the exact question for Alex, branch state, and the
     "Efficiency notes" section ...
   ```
   Insert a new first bullet: "Read `Docs/tickets/BLOCKED_TEMPLATE.md`
   now — Step 3 no longer reads it upfront (T-148)." before the existing
   "Fill out..." bullet.

3. **Step 7** — currently opens with the milestone-checkbox/IMPLEMENTATION_NOTES/CHANGELOG
   bullets, then:
   ```
   - Write `Docs/tickets/reports/T-###-slug.md` per
     `Docs/tickets/REPORT_TEMPLATE.md` — outcome, diff stats, ...
   ```
   Insert a new bullet immediately before that one: "Read
   `Docs/tickets/REPORT_TEMPLATE.md` now — Step 3 no longer reads it
   upfront (T-148)." (Placed right before the "Write the report" bullet,
   not at the very top of Step 7, since the milestone-checkbox/notes/changelog
   bullets ahead of it don't need the template.)

Out of scope:
  - `.claude/skills/ticket-writer/SKILL.md`'s `Context files:` drafting
    convention — a ticket may still legitimately name
    `REPORT_TEMPLATE.md`/`BLOCKED_TEMPLATE.md` in its own `Context files:`
    list (harmless either way); this ticket only changes when the
    executor actually reads them, not whether `ticket-writer` keeps citing
    them.
  - Any other `Context files:` entry — this ticket's carve-out is scoped
    to exactly these two structural templates, not a general "defer
    everything" mechanism. A ticket-specific design/rationale file (e.g.
    a `G-###` excerpt) still needs to be read at Step 3, since it informs
    *what to build*, not just *how to format the report*.
  - Any mechanism to remove/evict already-read content from context — not
    available in this environment and not needed here (see Relevant
    background above).
  - `EXECUTOR_ROUTINE.md`'s Step 1/2/4/5 — untouched by this ticket.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `Docs/tickets/EXECUTOR_ROUTINE.md`'s Step 3 section text no longer
    instructs an unconditional read of `REPORT_TEMPLATE.md`/
    `BLOCKED_TEMPLATE.md` — its "every file listed in the ticket's Context
    files: field" bullet explicitly carves both out
  - Step 6 contains an explicit "read `BLOCKED_TEMPLATE.md` now" bullet
    ahead of its existing "Fill out `BLOCKED_TEMPLATE.md`" bullet
  - Step 7 contains an explicit "read `REPORT_TEMPLATE.md` now" bullet
    immediately ahead of its existing "Write the report" bullet
  - `grep -n "REPORT_TEMPLATE\|BLOCKED_TEMPLATE" Docs/tickets/EXECUTOR_ROUTINE.md`
    shows both filenames appearing only in the Step 3 carve-out sentence
    and their respective Step 6/Step 7 bullets — not anywhere implying an
    unconditional upfront read

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
