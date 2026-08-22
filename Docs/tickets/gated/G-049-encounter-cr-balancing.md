# G-049 — Encounter CR/party-size balancing

Gate type: 🧠 strategy

Milestone ref: `Docs/milestones/MILESTONES_V1_8_MCP.md` — Milestone M-GENERATE

Opened: 2026-08-22 — by Alex during `G-038`'s resolution, split out at Alex's explicit request rather than folded into that gate's own decision.

Context files (load ONLY these):
  - `Docs/tickets/gated/resolved/G-038-encounter-generation-and-save.md` (the gate this split from — records why balancing was carved out, and the `generate_encounter`/`encounters` table shape this decision would extend)
  - `Docs/tickets/gated/resolved/G-036-stat-block-template-system.md` § Resolution (the monster CR/XP column decision this gate's whole premise depends on)

Open question: Once `M-STATBLOCK`'s actual stat-block columns exist (they don't yet — deferred behind `G-039`, this gate's own hard prerequisite), should `generate_encounter` (or a related tool) validate or suggest encounter difficulty using CR vs. party level/size? If yes: (1) what CR-to-difficulty math (5e's own DMG table, a simplified ruleset-agnostic heuristic, or something the DM configures per campaign given QuestLog's multi-ruleset stat-block templates from `G-036`); (2) does the party's level/size come from a real party-roster concept (`G-044`, itself still gated) or does the DM supply it ad hoc per generation call; (3) is this a hard validation (reject/warn on an unbalanced ask) or purely informational (label the generated encounter's estimated difficulty, never block it).

Blocks: `Docs/milestones/MILESTONES_V1_8_MCP.md` Milestone M-GENERATE (balancing sub-scope only — `generate_encounter`'s core assemble-only behavior is unblocked and ticketed separately via `G-038`'s own resolution, not waiting on this gate)

Notes: Split from `G-038` at Alex's explicit call during that gate's resolution (2026-08-22) — same "review-round ask splits into its own gate" pattern `G-043` used for `G-047`/`G-048`. Has a real hard prerequisite this gate can't resolve around: monster CR/XP columns don't exist yet (`G-036`'s resolution deferred them behind `G-039`, still open), so there's no real CR data to balance against even once this gate's own design questions are answered. Likely also relevant: `G-044` (party roster concept, still gated) for where "party level/size" would actually come from — worth reading together with this gate when both are ready, though neither blocks the other's filing.
