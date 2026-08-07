# G-041 — Generalized automatic detection-from-session-text (beyond inventory)

Gate type: 🧠 strategy

Milestone ref: `Docs/milestones/MILESTONES_V1_9_MCP.md` — Milestone
  M-DETECT. Reserved alongside `G-042` (item template system, unrelated
  scope) under the same v1.9 slot — see that doc's "Why v1.9 exists" for
  why the two share a version number.

Opened: 2026-08-07 — filed by agent during `G-023`'s `/ungate` resolution,
  per Alex's explicit choice: M-INVENTORY ships manual-tool-calls-only for
  v1 (no `log_session` auto-detection of loot/wealth), but Alex wants the
  broader question — generalizing automatic freeform-text detection as its
  own feature axis, not scoped narrowly to inventory — captured now rather
  than dropped, and answered later once there's more than one concrete
  consumer for it.

Context files (load ONLY these):
  - packages/mcp/src/tools/log-session.ts, packages/mcp/src/tools/confirm-log-session.ts (the only existing automatic-detection-from-freeform-text pattern today: scans session-log content, proposes entity links via a `write_requests` preview)
  - packages/core/src/services/entity-candidate-detection.service.ts (the detection mechanism `log_session` uses — the pattern any generalized detector would extend or replace)
  - Docs/tickets/gated/resolved/G-015-auto-entity-extraction-design.md (worked precedent: scoping automatic-detection-and-confirm end to end, for `ingest_text` specifically — same shape of decision this gate needs, generalized)
  - Docs/milestones/MILESTONES_V1_5_MCP.md Milestone M-INVENTORY (once ticketed via this gate's sibling `G-023` — the concrete first candidate consumer: loot/wealth mentions in session text, explicitly deferred out of T-142/T-143/T-144's scope)

Open question: Should QuestLog build one generalized "detect mentions of X
  in freeform text and stage for confirm" mechanism, reusable across entity
  detection (`log_session`'s existing path), inventory/loot detection, and
  any future detection need — or does each feature keep its own bespoke
  detector? If generalized: what's the shared shape (a pluggable detector
  registry keyed by entity/pattern type? a shared span-detection primitive
  with per-feature interpreters?), and does adopting it mean retrofitting
  `log_session`'s existing entity-detection path too, or does it only apply
  to detectors built after this gate resolves?

Blocks: `Docs/milestones/MILESTONES_V1_9_MCP.md` Milestone M-DETECT (no
  tickets exist yet — this gate's resolution is what makes M-DETECT's task
  list draftable). Not a blocking dependency of anything shipping today:
  `M-INVENTORY`'s tickets (`T-142`/`T-143`/`T-144`) ship without
  auto-detection and are explicitly not blocked on this gate.

Notes: Raised so `M-INVENTORY`'s schema/tool design (`G-023`) doesn't
  foreclose a future auto-detect capability for loot/wealth, without
  pulling detection-mechanism work into v1.5's inventory scope now. Revisit
  once there's a second or third concrete feature actually wanting
  freeform-text detection — today `log_session` (entities) is the only
  shipped instance, so "generalize" is still a one-example judgment call;
  this gate exists to hold the question open, not to answer it prematurely
  with only one data point.
