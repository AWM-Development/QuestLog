# G-021 — Entity-extraction algorithm quality: heuristic sophistication and unclassified fallback

Gate type: 🧠 strategy

Milestone ref: Docs/milestones/MILESTONES_V1_3_MCP.md M-EXTRACT

Opened: 2026-08-02 — filed by agent during `/morning-review` of T-078's merged PR (#158);
  broadened same day after further review discussion with Alex from a narrower
  classification-only question to a full review of the extraction algorithm's
  approach and the file organization it landed in. Its original third
  sub-question (code organization) was resolved inline on the same PR rather
  than left for `/ungate` — see Notes.

Context files (load ONLY these):
  - packages/core/src/services/entity-candidate-detection.service.ts (`findProperNounSpans`, `guessEntityType`, `tokenCore`, `isCapitalizedCore`, `rangesOverlap`, `NAME_CONNECTORS`, `CAPITALIZED_STOPWORDS` — the pure heuristic code this gate is about, now in its own module)
  - packages/shared/src/constants/index.ts (`ENTITY_TYPES` — the taxonomy `guessEntityType` classifies into, with no "unclassified" member today)
  - packages/core/src/services/search.service.ts, packages/core/src/services/voyage.client.ts (the hybrid vector+keyword search / embedding infrastructure already built and in production use elsewhere in the app — the standard this gate asks whether entity extraction should be held to, given the product's core premise is sophisticated lore search, not keyword matching)
  - Docs/tickets/gated/resolved/G-015-auto-entity-extraction-design.md (resolved the trigger/stage/confirm-flow questions for M-EXTRACT; explicitly did not address extraction *algorithm* quality — see T-078's own Out-of-scope line: "introducing an LLM call is a bigger design question not resolved in G-015")
  - Docs/tickets/backlog/T-079-ingest-text-stage-entity-candidates.md (M-EXTRACT.2/.3 — both build directly on `detectCandidates`'s output; the longer this gate stays open, the more call sites accrete on top of a heuristic that might change)

Open question: T-078 implemented entity-candidate detection as a hand-rolled,
  closed-list heuristic: capitalization + a hardcoded 8-word connector set
  (`of/the/de/van/von/da/di/and`) + a hardcoded ~70-word capitalized-stopword
  set for span detection, then a cue-ordered regex ladder for type
  classification. Two distinct sub-decisions, both currently unresolved:

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

Blocks: none yet — no ticket currently depends on this gate resolving.
  T-079/T-080/T-081 (M-EXTRACT.2/.3) can proceed on the current heuristic,
  since the `write_requests` confirm step (G-015's resolution) means a wrong
  guess is a one-click correction at confirm time, not a silent bad write —
  but each of those tickets is a new consumer of `detectCandidates`'s output
  shape, so resolving this sooner rather than later avoids compounding the
  cost of a later algorithm swap.

Notes: This gate originally carried a third sub-question — whether the
  ~250 lines of pure text-processing logic (`findProperNounSpans`,
  `guessEntityType`, etc.) belonged in the DB-facing `entity.service.ts`
  they'd been appended to. That one didn't actually need Alex's strategic
  input — this codebase already has a precedent (`chunking.service.ts`, a
  pure, DB-free `*.service.ts` file) that settles it by convention, not
  judgment call. Resolved inline on the same PR: the logic moved to a new
  `entity-candidate-detection.service.ts`, no behavior change, full suite
  reverified green. See `Docs/IMPLEMENTATION_NOTES.md` § T-078 for detail.
  This gate now covers only the two questions that are genuine strategy
  calls. Low urgency by design — G-015 deliberately built extraction as
  propose-then-confirm specifically so classification mistakes are cheap to
  catch before anything is created — but "cheap to correct at confirm time"
  is not the same claim as "the algorithm is good enough," and this gate
  exists to force that distinction to a real decision rather than let it
  default silently.
