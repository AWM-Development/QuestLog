# Sub-ticket A: Complexity-tier taxonomy — real bug + centralization

**Branches off:** `feat/m-obs/t-057-observability-dashboard-trends-view` (PR #310), at `617efc5`.
**PR target:** into that branch, not `develop` — this is a fast-follow on T-057, not standalone.
**Not run through `ticket-writer`/`TICKET_SPEC.md`** — informal context doc per Alex's call during `/morning-review`'s deep review of T-057 (2026-08-23). Write it up as a real ticket retroactively if useful once the work's done, but don't block starting on that.

## Why this is split out, not patched inline

Two real problems tangled together, surfaced via PR #310 review comments on `stats.ts:57/68/86`, `TierRow.tsx:8`, and fresh pushback on `CostScatterChart.tsx:20/31`:

1. **A live correctness bug.** `Docs/tickets/TICKET_SPEC.md`'s actual current complexity-tier rubric is `XS | S | M | L | D` (set by `T-050`/`M-OBS.6`, which shipped *before* T-057). `apps/observability-dashboard` hardcodes `"s" | "m" | "l"` in seven places — `index.css`, `types.ts`, `stats.ts` ×2, `CostScatterChart.tsx` ×2, `TierRow.tsx` ×2 — none referencing a shared source. Any ticket run tagged `XS` or `D` is silently invisible in every tier breakdown, every tier badge, and the scatter chart's tier coloring.
2. **No shared source of truth.** The same five-value list should live in exactly one place this app imports from, not be restated per-file. Given it's a rubric the rest of the pipeline (ticket-writer, `board.service.ts`, `TICKET_SPEC.md` itself) also cares about, the right home might be `packages/shared` rather than something local to this app — that's part of what to investigate, not assumed.

Deliberately not stopgap-patched inline on T-057: picking interim colors/labels for `XS`/`D` under time pressure, without deciding where the taxonomy actually lives, would just be one more undecided design choice added to an already-long list of them on that branch.

## Scope

- Investigate where a shared tier-taxonomy constant should live (`packages/shared`? `packages/core`? something `apps/observability-dashboard`-local is only correct if nothing else in the repo would ever need it — check `board.service.ts`'s own tier handling first).
- Define real visual treatment for `XS` and `D` (colors consistent with `Docs/DESIGN_SYSTEM.md`'s status-color semantics — `S`/`M`/`L` currently map to `--status-info`/`--status-warning`/`--status-error`).
- Replace all seven hardcoded `"s" | "m" | "l"` occurrences in `apps/observability-dashboard` with imports from the new shared source.
- Update `.tag-tier-*` CSS classes in `apps/observability-dashboard/src/index.css` to cover all five tiers.

## Exit condition

- All tests green, typecheck clean, lint clean.
- A ticket tagged `XS` or `D` in seeded fixture data renders correctly (visible tier badge, included in per-tier stats, colored correctly on the scatter chart) — not just silently dropped.
- No remaining hardcoded `"s" | "m" | "l"` literal anywhere in `apps/observability-dashboard/src/` — grep for it as part of verification.

## PR comment threads this closes (reply + resolve on PR #310 once done)

- `stats.ts:57` (comment id `3839323523`) — "these tiers are out of date... abstract to one location"
- `stats.ts:68` (comment id `3839324282`) — "see comment above"
- `stats.ts:86` (comment id `3839325116`) — "we really missed a core change... may need a follow up ticket"
- `TierRow.tsx:8` (comment id `3839335527`) — "this is everywhere... major DRY violation"
- `CostScatterChart.tsx:20` (comment id `3839354469`) — "again, this need to be a global..."
- `CostScatterChart.tsx:31` (comment id `3839354865`) — "wrong methodology..."
