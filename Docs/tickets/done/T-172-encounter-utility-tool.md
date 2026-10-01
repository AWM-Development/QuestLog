# T-172 — encounter utility tool: initiative sort + HP delta, stateless

Milestone ref: M-ENCOUNTER (`Docs/milestones/MILESTONES_V1_8_MCP.md`)

Complexity tier: S

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-encounter/t-172-encounter-utility-tool

Context files (load ONLY these):
  - packages/mcp/src/tools/add-item.ts (closest existing precedent: a "quick-action" tool per `.claude/rules/mcp.md`'s carve-out — no preview/confirm, no audit trail — though unlike this ticket's tool, it still takes `db`)
  - packages/mcp/src/tools/types.ts (`ToolDeps` — this ticket's tool is the first that needs none of these fields; see Scope)
  - packages/mcp/src/server.ts (tool registration list)
  - packages/shared/src/validators/mcp.ts (existing input-validator file — add the new `Combatant`/`EncounterUtilityInput` shapes alongside the others)
  - packages/mcp/src/content/tool-descriptions.ts (existing `*_DESCRIPTION` constants — add `ENCOUNTER_DESCRIPTION`)
  - packages/mcp/src/content/onboarding-instructions.ts and packages/mcp/src/content/onboarding-instructions.test.ts (T-140's drift test — this ticket's new tool name must appear in the prose)

## Relevant background

excerpted from `Docs/tickets/gated/resolved/G-037-live-encounter-mode.md` § Resolution, as of 2026-08-22

Live encounter state is **memory-only** — no persisted table, no
`encounter_sessions` row, nothing survives a dropped MCP connection. This
was a deliberate call, not the ticket-writer's default: most of the actual
turn-by-turn tracking (whose turn it is, narrating HP loss, describing
status effects) is expected to happen in the conversation itself — the
model holds the fight's state in its own context and narrates it, the same
way a human DM tracks a fight without opening a spreadsheet. The tool this
ticket builds is a small set of **stateless utility actions** for the
fiddly bits worth getting deterministically right rather than left to the
model's arithmetic: initiative ordering and HP-delta application. It is
explicitly not a state machine — no action takes or returns a full
"encounter" object that must be faithfully round-tripped turn after turn.
`Combatant`'s shape (see Scope) doubles as the standard reference format
Alex asked for, so the agent doesn't need to reinvent a tracking shape each
session — it's just a shared Zod type, not a lookup tool of its own.
Saved/reusable encounter presets ("plan an encounter, then say 'run
encounter X'") are explicitly **not** this ticket's scope — that's `G-038`
(NL encounter generation & save), which already has its own open question
about whether live mode requires a saved encounter to instantiate from.
This ticket's `Combatant` shape is the shared vocabulary `G-038`'s eventual
saved-encounter table is expected to reuse, not duplicate.

Mockup: none

Runner: claude-code

Model: sonnet

Scope:

  - **Shared `Combatant` shape** (new export in `packages/shared/src/validators/mcp.ts`,
    alongside the other tool input schemas): `{ name: string, entityId?:
    string (uuid), initiative: number, hp: { current: number, max: number
    }, status: string[] }`. `entityId` is optional — a combatant can be a
    real campaign entity (for flavor/lore reference via a separate
    `get_entity` call) or a fully improvised, never-logged monster added
    on the fly. `status` is freeform strings (e.g. `"prone"`,
    `"poisoned"`) — purely informational tags, no rules engine (tagging
    `"poisoned"` never triggers any mechanical effect).
  - **One new tool, `encounter`**, with an `action` discriminator (this is
    the one tool in this codebase built as a single action-parameterized
    tool rather than several focused ones — a deliberate exception, not a
    new default; see the `mcp.md` note below on why). Two actions for this
    ticket:
    - `roll_initiative`: input `{ combatants: Combatant[] }` (each
      `initiative` already rolled/decided by the DM or players — this tool
      never generates a random number itself), output the same list
      sorted descending by `initiative`, ties broken by input order
      (stable sort — first-listed combatant with a tied value goes
      first, matching how most tables actually resolve initiative ties:
      DM's call, arbitrary but consistent).
    - `apply_hp_delta`: input `{ current: number, max: number, delta:
      number }` (negative `delta` = damage, positive = healing), output
      `{ newHp: number, status: "healthy" | "bloodied" | "down" }` —
      `newHp` clamped to `[0, max]`; `status` is `"down"` at 0, `"bloodied"`
      at ≤50% of `max`, `"healthy"` otherwise. Deliberately ruleset-agnostic
      (no 5e-specific death-save tracking, no other system's specific
      thresholds) — `"bloodied"`/`"down"` are near-universal fantasy-TTRPG
      concepts, not owned by any one ruleset.
  - **No `db` dependency**: this tool is pure computation — no read, no
    write, no lookup. Its handler takes only its own input, none of
    `ToolDeps`'s fields. This is genuinely new for this codebase (every
    existing tool takes at least `db`) — register it accordingly (skip
    whatever the registration helper does with `deps` if it turns out to
    assume every tool needs at least `db`; check `server.ts`'s actual
    wiring before assuming).
  - **Quick-action classification**: per `.claude/rules/mcp.md`'s carve-out
    (the inventory tools' precedent), `encounter` needs no preview/confirm
    pair and no `write_requests` audit trail — it never mutates anything,
    so this is actually a simpler case than that carve-out already covers
    (those tools mutate a persisted row; this one persists nothing at
    all).

Out of scope: Any persisted encounter state (`encounter_sessions` table or
  equivalent) — memory-only per the gate's resolution. Turn-advancement
  bookkeeping (current-turn index, round counter) as a tool action — this
  is simple index arithmetic the model can do directly in conversation
  without a deterministic-correctness need the way initiative sorting and
  HP-clamping have; add it later only if it turns out the model gets this
  wrong in practice. Natural-language customization of combat state (e.g.
  "give the goblin +2 to its next save") — explicit v1.8 stretch/follow-on
  per the gate, not core scope. Saved/reusable encounter presets, NL
  encounter generation, or any new table — entirely `G-038`'s scope. Dice
  rolling of any kind (initiative, damage, anything) — combatants'
  `initiative` values are supplied already-determined, this tool only
  organizes them.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `encounter` with `action: "roll_initiative"` and a fixture of ≥3
    combatants with distinct initiative values (including at least one
    tied pair) returns them sorted descending by initiative, tie broken by
    original input order
  - `encounter` with `action: "apply_hp_delta"` asserts all three status
    bands: a delta that leaves `newHp` above 50% of `max` returns
    `"healthy"`; a delta landing at or below 50% (but above 0) returns
    `"bloodied"`; a delta that would take `newHp` below 0 clamps to `0` and
    returns `"down"`; a positive `delta` (healing) that would exceed `max`
    clamps to `max`
  - the tool's registration doesn't require a `db`/`storage`/`llmService`
    dependency to be constructed — a test invoking it with a minimal or
    absent `ToolDeps` (whichever the actual registration signature ends up
    requiring) still succeeds
  - `onboarding-instructions.test.ts`'s drift check passes with `encounter`
    newly registered

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_8_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
