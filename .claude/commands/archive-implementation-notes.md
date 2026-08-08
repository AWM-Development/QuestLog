---
description: Audit Docs/IMPLEMENTATION_NOTES.md section by section and propose which entries are safe to retire (governing milestone shipped, or the surface they describe is v2-deferred/superseded) — then, on confirmation, move the confirmed ones to Docs/IMPLEMENTATION_NOTES_ARCHIVE.md
argument-hint: [milestone id | none]
---

Resolve scope from `$ARGUMENTS`:
- Empty → audit every `##` section in `Docs/IMPLEMENTATION_NOTES.md`.
- A milestone id or family (e.g. "v1", "M-MCP", "Milestone 4") → limit the audit to sections tagged with that family; still read the whole file for context (a section's true owner isn't always obvious from its heading alone — see step 2).

This is an interactive-session command, run with Alex present — it proposes an audit, it does not auto-execute one. Never invoked by the nightly executor.

## Procedure

1. Read `Docs/IMPLEMENTATION_NOTES.md` in full, plus `AGENTS.md`'s task-source line (which milestone docs are "shipped" vs. "in progress" right now) and each milestone doc named there for its own header Status line (e.g. `MILESTONES_V1_MCP.md`: "v1, shipped").

2. For every `##` section, classify it into exactly one bucket:
   - **Archive — shipped milestone.** The section is tagged with a milestone id (`M-MCP.*` directly, or a ticket id whose own file under `Docs/tickets/done/T-###-*.md` has a `Milestone ref:` pointing at one) whose governing doc's Status line reads "shipped," **and** the content is either fully superseded by a later section already in the file, or describes something that's now just how the shipped system works — stable, not a gotcha a fresh session would trip on.
   - **Archive — superseded/dead surface.** The section describes a surface `AGENTS.md` marks as not currently live (e.g. pre-pivot "Milestone 4.x" web-UI entries — check against AGENTS.md's "the only kept web surface is SourcesPage; everything else is v2" line), regardless of which milestone doc nominally owns it. This can fire even for entries tagged to a milestone that predates the current numbering entirely.
   - **Keep — pipeline/tooling, still current.** The section documents pipeline mechanics (test infra, CI, executor routine, branch model) that stay live independent of which milestone shipped it. These often carry `Milestone ref: none` on their originating ticket — do not archive on a milestone-shipped basis alone; a pipeline-hygiene entry can outlive the milestone it was written during.
   - **Keep — active/in-progress.** Tied to a milestone doc still marked "in progress" (today: v1.1, v1.2), or describes code still under active change.
   - **Uncertain.** State your reasoning; do not force a guess into one of the buckets above.

3. Present the full classification as a table — section title, its line range in the current file, bucket, one-line reasoning — as your response. This *is* the audit deliverable. Stop here. Do not move anything yet.

4. Wait for Alex to confirm which sections to actually archive (typically "everything in Archive — shipped milestone and Archive — superseded/dead surface," possibly amended after seeing the table, plus any Uncertain entries Alex resolves by hand). Do not archive an Uncertain entry without an explicit call on it.

5. On confirmation, for each confirmed section: move it verbatim — cut from `Docs/IMPLEMENTATION_NOTES.md`, append to `Docs/IMPLEMENTATION_NOTES_ARCHIVE.md` — preserving its exact heading and body, in the same relative order it appeared in the source. Never rewrite content while moving it; archiving is a relocation, not an edit (same "durable record" principle `GATE_SPEC.md`/`TICKET_SPEC.md` use for resolved gates and won't-fix tickets — move, don't delete, don't rewrite history).
   - If `Docs/IMPLEMENTATION_NOTES_ARCHIVE.md` doesn't exist yet, create it first with a header mirroring `IMPLEMENTATION_NOTES.md`'s own shape:
     ```markdown
     # QuestLog — Implementation Notes Archive

     **Purpose:** Retired entries from `Docs/IMPLEMENTATION_NOTES.md` — historical record, not required reading. An entry lands here once its governing milestone has shipped and the entry no longer describes a live gotcha, or the surface it describes is v2-deferred. Entries are moved verbatim, never rewritten.
     **Last Updated:** <today's date>
     ```
   - Also add a one-line entry for it under `Docs/README.md`'s "Development" section, next to `IMPLEMENTATION_NOTES.md`'s own bullet — same obligation `Docs/README.md` already documents for every doc it indexes.

6. Update `Docs/IMPLEMENTATION_NOTES.md`'s own header: bump `Last Updated` to today, and if the archive file didn't previously exist, add one line under Purpose pointing at it ("Retired entries: `Docs/IMPLEMENTATION_NOTES_ARCHIVE.md`").

7. Report back: how many sections moved (and which), the resulting line count of `Docs/IMPLEMENTATION_NOTES.md` against `ci.yml`'s 300-line soft-warning threshold (`impl-notes-health` job), and the full list of anything left in Uncertain for a future run.

## What this command does not do

- Does not touch `Docs/milestones-archive/` (a different archive — per-milestone `PLAN.md`/`DESIGN_SPEC.md`/`REPORT.md` from the old pre-ticket-pipeline workflow, not `IMPLEMENTATION_NOTES.md` excerpts) or `Docs/tickets/archive/` (parked ticket files). This command's scope is `Docs/IMPLEMENTATION_NOTES.md` and its new archive file only.
- Does not edit, correct, or "modernize" a section's content while archiving it — a moved entry is frozen at what it said, same as `CHANGELOG.md` entries and `Docs/tickets/reports/*` per `Docs/README.md`'s doc-dating convention.
- Does not run unattended. If invoked in a context with no Alex present to confirm step 4, stop after step 3 and report the audit table only.
