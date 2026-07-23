# G-001 — Does preview/confirm/audit apply to every MCP write tool, or only ones mutating existing data?

Gate type: 🧠 strategy

Milestone ref: M-REMOTE.4, M-REMOTE.5 (`Docs/MILESTONES_V1_1_MCP.md`)

Opened: 2026-07-23 — filed by agent during a process audit of the `tickets/v1.1` branch against the new `GATE_SPEC.md` mechanism (T-031 and T-032 were originally drafted with this question answered inline, unilaterally, rather than surfaced)

Context files (load ONLY these):
  - .claude/rules/mcp.md (the rule this question is about)
  - Docs/tickets/backlog/T-031-mcp-ingest-text-tool.md (drafted assuming the narrow reading)
  - Docs/tickets/backlog/T-032-mcp-create-entity-tools.md (same)
  - apps/mcp/src/tools/log-session.ts, apps/mcp/src/tools/confirm-log-session.ts (the only precedent this pattern currently has)

Open question: `.claude/rules/mcp.md` says preview/confirm/audit is
  mandatory for `log_session`, and justifies it by calling `log_session`
  "the only write path exposed over MCP" — worded as though the rule's
  author expected the pattern to cover any future write tool, not just
  `log_session` specifically. T-031 (`ingest_text`) and T-032
  (`create_entity`/`append_entity_note`) were drafted assuming a narrower
  reading instead: direct writes are fine for purely additive operations
  (a new source row, a new entity row, an appended note) that never
  overwrite or delete anything that existed before the call, reserving
  preview/confirm for mutations of existing data. Which reading is
  correct? Does the answer change once these tools are reachable
  remotely over the M-REMOTE.3 HTTP transport, rather than only locally
  over stdio?

Blocks: M-REMOTE.4 (T-031), M-REMOTE.5 (T-032)

Notes: Both T-031 and T-032 currently ship with the narrow reading baked
  in, each with only an inline hedge ("if this reasoning turns out to be
  wrong, flag it and fall back to preview/confirm") rather than treating
  it as an open decision — exactly the pattern `GATE_SPEC.md` exists to
  stop. Filed here instead of resolved unilaterally, per `CLAUDE.md`'s
  "never resolve a 🧠 gate yourself" rule.

  If resolved toward "direct writes are fine for additive-only
  operations": both tickets proceed close to as-drafted, plus a small
  definitional edit to `.claude/rules/mcp.md` recording the narrowed
  scope so the next write tool doesn't have to re-litigate this.

  If resolved toward "every write tool needs preview/confirm, no
  exceptions": both tickets need their Scope/Exit-condition rewritten to
  add a `confirm_ingest_text`/`confirm_create_entity` step mirroring
  `log_session`/`confirm_log_session`'s shape — a meaningfully bigger
  ticket each, and `/ungate` should redraft them rather than patch the
  existing scope in place.

## Resolution (2026-07-22)

Decided with Alex: **narrow reading** — preview/confirm/audit applies to
tools that mutate *existing* records (update, append-to, or delete
something already there), not to "any tool that performs a write" in
general. A tool that only ever inserts a brand-new row with nothing prior
to overwrite (`ingest_text`'s new `sources`/`chunks` rows, `create_entity`'s
new entity row, `append_entity_note`'s new note content) is a direct write,
no preview/confirm pair needed. `log_session` needs the pattern specifically
because its entity-consolidation step appends to entity records that
already exist — that's the risk being mitigated, not "this is a write."

Also decided: this does **not** change once these tools are reachable
remotely over the M-REMOTE.3 HTTP transport rather than only locally over
stdio. The preview/confirm trigger is the operation's effect on existing
data, not the transport it arrives over — no transport-conditional logic.

`.claude/rules/mcp.md` rewritten to record this as the general rule (with
`log_session` framed as the motivating example, not the rule's boundary),
rather than narrowly describing only `log_session`. `T-031` and `T-032`
had their `Gated on: G-001` line dropped and their preview/confirm-exemption
notes firmed up from hedge language to a confirmed decision — both remain
in `backlog/` on their unresolved `Blocked on: T-028` (T-028 is still in
`queue/`, not yet merged). Pointer added to `Docs/IMPLEMENTATION_NOTES.md`.
