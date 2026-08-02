# G-021 — Entity-extraction algorithm quality: heuristic sophistication, hardcoded word lists, and code organization

Gate type: 🧠 strategy

Milestone ref: Docs/milestones/MILESTONES_V1_3_MCP.md M-EXTRACT

Opened: 2026-08-02 — filed by agent during `/morning-review` of T-078's merged PR (#158);
  broadened same day after further review discussion with Alex from a narrower
  classification-only question to a full review of the extraction algorithm's
  approach and the file organization it landed in.

Context files (load ONLY these):
  - packages/core/src/services/entity.service.ts (`findProperNounSpans`, `guessEntityType`, `tokenCore`, `isCapitalizedCore`, `rangesOverlap`, `NAME_CONNECTORS`, `CAPITALIZED_STOPWORDS` — the ~250 lines of pure text-processing/heuristic code this gate is about, currently appended to a 740-line DB-facing service file)
  - packages/core/src/services/chunking.service.ts (existing precedent in this same codebase: a pure, DB-free `*.service.ts` file for text-processing logic, kept separate from any service that takes `db` as its first argument — the organizational pattern T-078 did not follow)
  - packages/core/src/lib/utils.ts (existing home for small pure helpers shared across services — the other candidate location for this kind of logic)
  - packages/shared/src/constants/index.ts (`ENTITY_TYPES` — the taxonomy `guessEntityType` classifies into, with no "unclassified" member today)
  - packages/core/src/services/search.service.ts, packages/core/src/services/voyage.client.ts (the hybrid vector+keyword search / embedding infrastructure already built and in production use elsewhere in the app — the standard this gate asks whether entity extraction should be held to, given the product's core premise is sophisticated lore search, not keyword matching)
  - Docs/tickets/gated/resolved/G-015-auto-entity-extraction-design.md (resolved the trigger/stage/confirm-flow questions for M-EXTRACT; explicitly did not address extraction *algorithm* quality — see T-078's own Out-of-scope line: "introducing an LLM call is a bigger design question not resolved in G-015")
  - Docs/tickets/backlog/T-079-ingest-text-stage-entity-candidates.md (M-EXTRACT.2/.3 — both build directly on `detectCandidates`'s current output and file location; the longer this gate stays open, the more call sites accrete on top of a shape that might change)

Open question: T-078 implemented entity-candidate detection as a hand-rolled,
  closed-list heuristic: capitalization + a hardcoded 8-word connector set
  (`of/the/de/van/von/da/di/and`) + a hardcoded ~70-word capitalized-stopword
  set for span detection, then a cue-ordered regex ladder for type
  classification. Three distinct sub-decisions, all currently unresolved:

  1. **Algorithm sophistication ceiling.** Closed word lists are structurally
     brittle — `CAPITALIZED_STOPWORDS` will always under-cover real English
     (any capitalized sentence-initial word not on the list becomes a
     false-positive span start, e.g. "Beyond the ridge, a shadow moved."),
     and `NAME_CONNECTORS` encodes only Western-European naming conventions,
     with "and" specifically risking merging two adjacent capitalized names
     ("Strahd and Ireena") into one candidate. QuestLog's core premise is
     sophisticated lore search (hybrid vector + keyword search already
     built and in production for `query_lore`) — is a capitalization-heuristic
     entity extractor, using none of that same embedding/LLM infrastructure,
     an acceptable long-term answer for this feature, or does this warrant
     the same investment (LLM-assisted or embedding-based classification)
     that search already received? If heuristic-only is kept intentionally
     (cost/latency reasons), what accuracy target is "good enough" and how
     would it actually be measured — no eval harness or accuracy benchmark
     exists for this path today.
  2. **Unclassified fallback.** A span that matches none of `guessEntityType`'s
     cues silently defaults to `npc`, since `ENTITY_TYPES` has no
     "unclassified" member. Should a genuinely unclassifiable span keep
     defaulting to `npc`, or should the extraction path (not necessarily
     `ENTITY_TYPES` itself, which `create_entity` also validates against)
     gain a distinct "unclassified" bucket surfaced at confirm time instead
     of silently mislabeling e.g. an unrecognized location as an NPC?
  3. **Code organization.** This ~250 lines of pure text-processing logic
     (no `db` argument, no DB dependency at all) was appended directly into
     `entity.service.ts`, which otherwise holds DB-facing CRUD/query methods
     (`create`, `detectSpans`, etc.) — growing that file to 740 lines. This
     codebase already has a precedent for keeping this kind of logic
     separate: `chunking.service.ts` is a pure, DB-free `*.service.ts` file
     with no `db` parameter, following the same shape this new code has.
     Should `findProperNounSpans`/`guessEntityType`/the two hardcoded word
     lists move into their own module (mirroring `chunking.service.ts`'s
     precedent, or `packages/core/src/lib/`) before T-079/T-080/T-081 add
     more logic on top of the current location?

Blocks: none yet — no ticket currently depends on this gate resolving.
  T-079/T-080/T-081 (M-EXTRACT.2/.3) can proceed on the current heuristic
  and its current file location, since the `write_requests` confirm step
  (G-015's resolution) means a wrong guess is a one-click correction at
  confirm time, not a silent bad write — but each of those tickets is a new
  consumer of `detectCandidates`'s current shape and location, so resolving
  this sooner rather than later avoids compounding the refactor cost.

Notes: This supersedes a narrower version of this gate that covered only
  sub-question 2 (unclassified fallback) — broadened same day after Alex
  pushed back on the "simple heuristic, hardened later" framing, on both
  the algorithm's actual sophistication (closed hardcoded word lists,
  not sophisticated matching) and the code organization it was jammed into
  without following this repo's own existing pattern for separating
  pure text logic from DB-facing services. Low urgency by design — G-015
  deliberately built extraction as propose-then-confirm specifically so
  classification mistakes are cheap to catch before anything is created —
  but "cheap to correct at confirm time" is not the same claim as "good
  code," and this gate exists to force that distinction to a real decision
  rather than let it default silently.
