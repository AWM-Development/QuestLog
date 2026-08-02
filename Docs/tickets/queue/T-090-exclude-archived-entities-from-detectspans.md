# T-090 — Exclude archived entities from `log_session` auto-linking (`detectSpans`)

Milestone ref: M-REMOTE.10 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Priority: P2

Blocked on: T-088 — must be merged into develop first (adds
  `entities.status` and parameterizes `wordSimilarityCandidateFilter` by
  status)

Branch: feat/m-remote/t-090-exclude-archived-entities-detectspans

Context files (load ONLY these):
  - packages/core/src/services/entity.service.ts (`detectSpans`,
    `wordSimilarityCandidateFilter` — the candidate query `detectSpans`
    runs against `entities`, parameterized for status by T-088)
  - packages/mcp/src/tools/log-session.ts (calls `detectSpans` to build
    the preview's `entityLinks.confirmed`/`ambiguous`)
  - packages/mcp/src/tools/confirm-log-session.ts (consumes the same
    span data at confirm time)

Mockup: none

Model: sonnet

Scope:
  Alex's refined framing for G-006 (2026-07-30): archive is a **hide**
  mechanism for a mistaken entity or note, not a way to mark something
  narratively dead — a killed NPC or an abandoned location stays fully
  active and should still get auto-linked when mentioned. But an archived
  (hidden-by-mistake) entity should never resurface anywhere by default,
  including the one search-shaped path T-088 doesn't touch:
  `detectSpans`, the fuzzy candidate query `log_session` runs to
  auto-detect and link entity mentions in session text.

  1. `entityService.detectSpans`'s candidate query excludes
     `status: "archived"` entities unconditionally — no opt-in flag. This
     is automatic detection during session logging, not a user-invoked
     search a DM could pass a "show archived" flag to; if a hidden entity
     needs to be linked again, unarchive it first via T-089's tools.
  2. No new tool surface — `log_session`'s preview
     (`entityLinks.confirmed`/`entityLinks.ambiguous`) and
     `confirm_log_session`'s persisted links both inherit this
     automatically once `detectSpans` itself filters, since both already
     consume `detectSpans`'s output as-is.

Out of scope:
  - No opt-in "include archived in detection" flag — see rationale above.
  - No change to `entityService.getByName`/`list`/`getById` — that's
    T-088.
  - No change to `archive_entity`/`unarchive_entity` tools — that's T-089.
  - No change to `apps/server/src/routers/entity.ts`'s own `detectSpans`
    call — it inherits the same filtering for free since it calls the
    same service method with no separate candidate query to update.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary
  - `detectSpans` seeded fixture: one active entity and one archived
    entity sharing a name/alias that would otherwise both match the same
    text span → only the active entity appears in the returned spans; the
    archived one is absent entirely (not even as an ambiguous candidate)
  - a session mentioning only an archived entity's name produces zero
    entity spans from `detectSpans` (no false auto-link, no crash)
  - `log_session`'s preview payload reflects this: `entityLinks.confirmed`
    and `entityLinks.ambiguous` never include an archived entity

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-REMOTE.10 in
  `Docs/milestones/MILESTONES_V1_1_MCP.md` (this is the last of the three
  tickets — T-088/T-089/T-090 — that completes it), `IMPLEMENTATION_NOTES.md`
  updated if any non-obvious decision was made, a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written.
