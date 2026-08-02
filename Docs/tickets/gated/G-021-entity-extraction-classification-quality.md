# G-021 — Entity-extraction classification quality: heuristic ceiling and unclassified fallback

Gate type: 🧠 strategy

Milestone ref: Docs/milestones/MILESTONES_V1_3_MCP.md M-EXTRACT

Opened: 2026-08-02 — filed by agent during `/morning-review` of T-078's merged PR (#158)

Context files (load ONLY these):
  - packages/core/src/services/entity.service.ts (`detectCandidates`, `guessEntityType`, `findProperNounSpans` — the heuristic extraction path this gate is about)
  - packages/shared/src/constants/index.ts (`ENTITY_TYPES` — the existing taxonomy `guessEntityType` classifies into, with no "unclassified" member today)
  - Docs/tickets/gated/resolved/G-015-auto-entity-extraction-design.md (resolved the trigger/stage/confirm-flow questions for M-EXTRACT; explicitly did not address extraction *accuracy* — see its own T-078 ticket's Out-of-scope line: "introducing an LLM call is a bigger design question not resolved in G-015")
  - Docs/tickets/backlog/T-079-ingest-text-stage-entity-candidates.md (the stage/confirm flow this classification feeds into — relevant because the confirm-before-create step is the main mitigation for a wrong guess today)

Open question: `guessEntityType` (`entity.service.ts`) is a hand-written,
  cue-ordered regex heuristic — no NLP/LLM — that classifies each detected
  proper-noun span into `npc`/`location`/`faction`/`item`/`arc` by matching
  name-suffix words (Castle/Clan/Sunblade/Prophecy/…) and short preceding-text
  cues ("traveled to", "wielded", "joined", …). Any span that matches none of
  those cues silently defaults to `npc`, since `ENTITY_TYPES` has no
  "unclassified"/"unknown" member to fall back to instead. Two sub-decisions:
  (1) is the current heuristic's accuracy ceiling acceptable as a durable v1
  answer, or does extraction eventually warrant an LLM-assisted classification
  pass (and if so, what cost/latency/reliability tradeoff is acceptable —
  this was explicitly deferred out of T-078, not decided against); (2) should
  a genuinely unclassifiable span default to `npc` as today, or should
  `ENTITY_TYPES` (or the extraction path specifically) gain a distinct
  "unclassified" bucket surfaced at confirm time, rather than silently
  mislabeling e.g. an unrecognized location as an NPC?

Blocks: none yet — no ticket currently depends on this being resolved;
  T-079/T-080/T-081 (M-EXTRACT.2/.3) proceed on the current heuristic as-is,
  since the `write_requests` confirm step (G-015's resolution) means a wrong
  guess is a one-click correction at confirm time, not a silent bad write.

Notes: Low urgency by design — G-015 deliberately built extraction as
  propose-then-confirm specifically so classification mistakes are cheap to
  catch and correct before anything is created, per Alex's own note that this
  gate stub's forcing function ("but preview will help to avoid these
  issues") is already the mitigation in place today. This gate exists to give
  the open question a durable home, not because current behavior is broken.
