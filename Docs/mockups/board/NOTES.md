# Ticket Board — Mockup Notes

**Resolves:** `Docs/tickets/gated/resolved/G-043-ticket-board-visual-design.md`
**Feeds:** `T-158` — Observability dashboard: Board view (frontend route)
**Related, deliberately out of this mockup's scope:** `G-047` (writable board — drag/⋮-menu are prototyped here but inert), `G-048` (milestone-aware Done filter + milestone search — the fixture data and interaction are prototyped here, but the real data model is that gate's job)

This mockup went through one review round with Alex (2026-08-22) before landing — two follow-on asks came out of that round and were deliberately **not** folded into this gate or `T-158`'s scope; see the two related gates above.

## Layout: third route on the existing app, same chrome

`/board` sits alongside `/` (Trends) and `/log` (Log) on `apps/observability-dashboard`, sharing its `chrome-header`/`chrome-nav` and every token from `Docs/mockups/observability-dashboard/shared.css` (`--bg-*`, `--text-*`, `--accent`, `--status-*`, `--font-*`, spacing/radius scale). Nothing here introduces a new token — same precedent as `G-004`'s original dashboard mockup.

Six columns, left to right, fixed order (not a design choice — settled in `G-043`'s Notes before the visual round): **Gated → Backlog → Queue → In-progress → Blocked → Done**, mirroring `Docs/tickets/`'s real folders 1:1.

## Column behavior

- Fixed width (240px), horizontal scroll on the board row if the viewport is too narrow for six columns — not a wrapping grid. Verified this stays column-aligned across a range of desktop widths (same class of bug T-057's Trends drill-down table had to fix).
- Each column's card list scrolls independently (`max-height: 560px`), so one long column never pushes the others' headers out of view.
- Empty columns (In-progress, Blocked in the fixture) use the plain no-mascot empty-state pattern already established for this ops tool by `G-004`'s resolution — headline + one line of context, no illustration, no CTA.

## Card content and density

Each card shows: id, title (2-line clamp), a one-line-clamped scope excerpt (2-line clamp, non-dense), complexity tier badge, priority tag, a milestone progress bar, and up to 2 `Blocked on:`/`Gated on:` chips with a `+N` overflow chip.

**Density is a live toggle** (top-right "Dense cards" checkbox in this static export; a props tweak in the working Design Components file) rather than a single fixed choice — Alex reviewed both and didn't need to force a pick, since the real implementation can default to comfortable and let density be a per-user preference later if it ever comes up. Dense mode: tighter padding, title clamps to 1 line, scope excerpt and milestone progress bar hide entirely (chips and priority stay).

## Milestone progress

A thin progress bar + `N/M` label on each card, sourced from the ticket's `milestoneRef`. Hovering it (desktop only — no touch equivalent designed) shows a fixed-position tooltip with the milestone's full task order, each marked done (checked, struck through) / current (highlighted, this card) / upcoming (dim). The same breakdown, full-width, repeats inside the ticket-details modal.

**This is fixture data.** The real `board.list` (or a sibling endpoint) has no milestone-aggregate concept today — see **`G-048`** for the actual data-model question (status derivation, new query surface, search scope).

## Ticket details modal

Click anywhere on a card except the grip/⋮-button opens a centered modal: id, tier, priority, milestone ref, current column, branch, full (untruncated) dependency chips, the milestone breakdown, and the full scope text. Closes via × or clicking the backdrop.

## Drag-and-drop and the ⋮ "Move to" menu — prototyped, not real

Both are **live in this mockup** (you can actually drag a card to another column, or use the ⋮ menu's inline "Move to" pills) but neither calls anything — it's local UI state only, reset on reload. This was an explicit ask from Alex to feel the interaction before committing to it as real product behavior. **`T-158` ships read-only**, per `G-043`'s original settled constraint; whether/how this becomes real is `G-047`'s job (write mechanism, guardrails on which columns a card can leave/enter, auth).

The ⋮ menu expands *inline* within the card (a "Move to" row of pill buttons) rather than a floating dropdown — deliberate, so it never gets clipped by the column's own `overflow-y: auto` scroll, which a floating popover would risk.

## Done column: milestone-filtered, with a "+N earlier" search entry point

Per Alex's direction mid-review: Done only shows tickets whose milestone is **still in-progress** — a fully-shipped milestone's tickets, or an unstarted milestone's (trivially none), don't clutter the column. In the fixture, `T-053`/`T-159`/`T-054` show (from `M-OBS.5`/`M-BUG.5`, both in-progress); tickets that were previously shown here (`T-154`, `T-144`, `T-156`, `T-155`, `T-149`, `T-147`, `T-146`, `T-145`) no longer appear on the board at all, because their milestones are fully complete — they're still reachable through the milestone search below, just not board clutter.

"+N earlier" at the bottom of Done is clickable and opens a milestone search overlay:
- A search input, initially listing all milestones (id, name, status pill — in-progress/completed/unstarted, progress fraction). Typing filters the milestone list by id/name and also surfaces individual matching tickets in a separate "Tickets" section below.
- Clicking a milestone (or a ticket hit) shows that milestone's full breakdown — every ticket, done and outstanding, in order — same visual language as the per-card tooltip, just untruncated.
- Back button returns to the list; × closes the whole overlay and clears the search text.

**This is also fixture data, and also not this gate's data-model call** — see `G-048`. The search itself is client-side filtering over an already-known milestone list in this mockup; whether that holds for the real implementation (vs. a server-side search) is explicitly one of `G-048`'s open questions.

## States

- **Loading**: pulsing skeleton cards per column (`Docs/DESIGN_SYSTEM.md` §8.1 pattern), column count hidden until data arrives.
- **Error**: a single centered panel (GitHub API read failure), not six broken columns — `--status-error` left border, retry button. Trends/Log are explicitly called out as unaffected in the copy, since they're independent reads.
- Both are reachable in this static export via the "Board state" dev-only dropdown in the top-right — that control is a mockup convenience, not part of the real UI.

## What's demo-only chrome, not real UI

The "Board state" dropdown and "Dense cards" checkbox in the toolbar exist only so this static export can show every state without needing the interactive Design Components canvas. Neither belongs in the shipped `/board` route.
