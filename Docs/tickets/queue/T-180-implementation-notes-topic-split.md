# T-180 — Split IMPLEMENTATION_NOTES.md into topic files

Milestone ref: cross-cutting pipeline/docs decision (ad hoc — resolved via
  `/ungate`, same framing `G-013`/`T-104` used; not an unticketed milestone
  task in its own right)

Complexity tier: D

Strategy-gate flag: yes

Priority: P1

Branch: chore/m-pipeline/t-180-implementation-notes-topic-split

Context files (load ONLY these):
  - Docs/IMPLEMENTATION_NOTES.md (the file being split — read in full)
  - Docs/tickets/gated/resolved/G-040-implementation-notes-doc-restructure.md
    (this ticket's own resolution — taxonomy, cross-cutting-entry rule,
    and why CHANGELOG.md is explicitly out of scope)
  - .claude/skills/archive-implementation-notes/SKILL.md (audits
    `IMPLEMENTATION_NOTES.md` section-by-section today; needs to operate
    over the new multi-file structure instead)
  - Docs/tickets/gated/resolved/G-013-documentation-duplication-reduction-strategy.md
    (cite-not-restate rule — governs how a cross-cutting entry's secondary
    topic file should point at its primary one, rather than duplicating it)

Mockup: none

Runner: claude-code

Model: sonnet

Scope: Replace the single `Docs/IMPLEMENTATION_NOTES.md` file with a
  `Docs/implementation-notes/` directory of five topic files, by area:
  `database.md`, `pipeline-executor.md`, `backend-services.md`,
  `frontend.md`, `tooling-infra.md`. Move every existing `## T-###`/
  `## G-###` entry (and the pre-existing umbrella sections — Database
  Migrations, Tooling, TypeScript & Module Resolution, Database, Agentic
  pipeline) into whichever topic file matches its primary subject —
  content relocation only, do not edit, re-litigate, or "clean up" any
  entry's actual rationale while moving it. A cross-cutting entry (touches
  more than one area, e.g. T-069's worktree convention) lives under its
  single most-central topic; if another topic file's content genuinely
  depends on it, add a one-line pointer there instead of duplicating the
  entry (per `G-013`'s cite-not-restate rule) — do not invent a sixth
  "cross-cutting" file.
  Add `Docs/implementation-notes/README.md` as the new canonical entry
  point: a corrected purpose blurb (the old file's "Read at the start of
  every session" is no longer true post-T-085 — replace with something
  like "excerpted into ticket bodies as needed; read in full only for
  audit/maintenance sessions"), plus an index table mapping every
  `T-###`/`G-###` id to the topic file it now lives in. This table is a
  human-navigation aid, not a citation-resolution mechanism — rewriting
  the ~90 live `IMPLEMENTATION_NOTES.md § T-###`-style citations elsewhere
  in the repo to name the new files directly is T-181's job, not this
  ticket's.
  Delete `Docs/IMPLEMENTATION_NOTES.md` once its content is fully moved.
  Update `.claude/skills/archive-implementation-notes/SKILL.md` to audit
  `Docs/implementation-notes/*.md` (all five topic files) instead of the
  single old path.
  Leave `Docs/IMPLEMENTATION_NOTES_ARCHIVE.md` untouched — the archive
  target doesn't change, only the source structure feeding it.

Out of scope:
  - Rewriting any of the ~90 live citations of
    `IMPLEMENTATION_NOTES.md § T-###` in code comments, rule files
    (`.claude/rules/*.md`, `.cursor/rules/*.mdc`), or queue/backlog ticket
    bodies — that's T-181 (`Blocked on: T-180`), since it needs this
    ticket's final file names to exist first.
  - Editing the substance of any moved entry.
  - Extending CHANGELOG.md's cite-not-restate posture — G-040's resolution
    explicitly leaves `CHANGELOG.md` as-is.
  - Touching `done/`/`archive/`/`reports/` ticket files that cite the old
    path — those are frozen point-in-time records (`G-013`'s existing
    exemption), unaffected by this split.

Exit condition (machine-checkable):
  - `Docs/IMPLEMENTATION_NOTES.md` no longer exists.
  - `Docs/implementation-notes/{database,pipeline-executor,backend-services,frontend,tooling-infra,README}.md`
    all exist.
  - Every `## T-###`/`## G-###` heading present in the pre-move file (diff
    against `develop`'s copy) appears in exactly one of the five topic
    files post-move — no heading dropped, none duplicated across two
    files. Verify by extracting both heading sets and diffing them.
  - `README.md`'s index table lists every `T-###`/`G-###` id from the
    pre-move file, each pointing at the topic file it actually landed in.
  - `README.md`'s purpose blurb no longer contains the phrase "at the
    start of every session."
  - `grep -r "Docs/IMPLEMENTATION_NOTES.md" .claude/skills/archive-implementation-notes/SKILL.md`
    returns nothing; the skill instead names the `Docs/implementation-notes/`
    directory or its five files.
  - all tests green, typecheck clean, lint clean (no application code
    touched — confirms no regression).

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
