# T-183 — Generalized freeform-text detector registry + retrofit log_session

Milestone ref: M-DETECT (`Docs/milestones/MILESTONES_V1_9_MCP.md`)

Complexity tier: L

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-detect/t-183-detector-registry

Context files (load ONLY these):
  - packages/core/src/services/entity.service.ts (`detectSpans` — the logic
    to move behind the registry; `detectCandidates` also calls
    `detectSpans` directly and must keep working unchanged)
  - packages/core/src/services/entity-candidate-detection.service.ts (pure
    text-processing heuristics `detectSpans` and `findProperNounSpans`
    both build on — unchanged by this ticket, just context for the shape
    of what a detector wraps)
  - packages/mcp/src/tools/log-session.ts (the retrofit target — currently
    calls `entityService.detectSpans` directly)
  - packages/core/src/services/continuity.service.ts (a second existing
    caller of `entityService.detectSpans` — stays on the direct call,
    named here only so it isn't mistaken for in-scope)
  - Docs/tickets/gated/resolved/G-041-generalized-freeform-text-detection.md
    § Resolution (the decision this ticket implements)

Scope: Build a small, pluggable detector registry in `packages/core` —
  e.g. `packages/core/src/services/detector-registry.service.ts` — with a
  `register(type: string, detector: DetectorFn)` call and a
  `detect(db, type: string, { campaignId, text, ...opts })` call that looks
  up the registered detector for `type` and invokes it, throwing a typed
  error (`packages/core/src/lib/errors.ts`, matching this codebase's
  existing typed-error convention — e.g. a new `NotFoundError`-style entry
  or an equivalent) for an unregistered `type`. Register the existing
  entity-mention detection as the first entry under key `"entity"` — a
  thin wrapper around `entityService.detectSpans` that adapts its existing
  `(db, { campaignId, text, dismissedEntityTexts })` signature to the
  registry's `DetectorFn` shape, calling straight through to
  `entityService.detectSpans` rather than duplicating its logic. Retrofit
  `packages/mcp/src/tools/log-session.ts` to call
  `detectorRegistry.detect(db, "entity", { campaignId, text: content })`
  instead of calling `entityService.detectSpans` directly — the returned
  `EntitySpan[]` shape and every downstream consumer of it
  (`confirmed`/`ambiguous` filtering, `entityConsolidation`) stay exactly
  as they are today; this is a plumbing change, not a behavior change.
  Module-load-time registration (the entity detector self-registers when
  its module is imported, e.g. via a side-effecting import in
  `packages/mcp/src/server.ts` or `packages/core`'s own service index —
  match whatever existing module-init pattern this codebase already uses
  for comparable one-time setup) so the registry is populated before any
  tool handler runs.

Out of scope: retrofitting `continuity.service.ts`'s own direct
  `entityService.detectSpans` call onto the registry — `G-041`'s
  resolution scopes the retrofit to `log_session`'s path only; leave
  `continuity.service.ts` untouched. Building any second detector
  (inventory/loot or otherwise) — no second consumer exists yet; this
  ticket only proves the registry pattern against the one detector that
  already exists. Changing `entityService.detectSpans`'s own
  implementation, `EntitySpan` shape, or `entity-candidate-detection.service.ts`'s
  heuristics — this ticket wraps existing behavior, it doesn't change it.
  Changing `confirm_log_session.ts` — its input payload shape is unchanged
  by this ticket.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a new registry unit test (e.g.
    `packages/core/src/services/detector-registry.service.test.ts`) proves:
    (a) `register("x", fn)` followed by `detect(db, "x", args)` invokes
    `fn` with the given args and returns its result; (b) `detect(db,
    "unregistered-key", args)` throws the typed not-found error instead of
    returning `undefined` or silently no-op-ing.
  - a `log-session.ts` test (extending its existing test coverage, or
    `packages/mcp/src/tools/log-session.test.ts` if one already exists)
    proves the entity-detection call now goes through the registry: mock/spy
    the registry's `detect` call and assert it's invoked with `"entity"`
    and the session content, and that `log_session`'s preview payload for
    a fixture already covered by `entity.service.test.ts`'s
    `detectSpans` suite (a piece of session content mentioning an existing
    seeded entity) is byte-for-byte the same `confirmed`/`ambiguous`
    span output as before this ticket's change.

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_9_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
