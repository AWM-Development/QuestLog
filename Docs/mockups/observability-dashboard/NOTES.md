# Observability Dashboard — Mockup Notes

**Resolves:** `Docs/tickets/gated/resolved/G-004-observability-dashboard-design.md`
**Feeds:** `M-OBS.5` — ticketed as T-057 (Trends), T-058 (Log + comments), T-059 (comment schema + write endpoint)

This mockup went through three review rounds with Alex before landing. What
follows is the *final* state and reasoning — see the gate-stub's own
Resolution section for the round-by-round history if you need it.

## Layout: separate routes, not tabs — and only two of them

Trends (`index.html`) and Log (`log.html`) are separate static pages
sharing one top-nav chrome, not a single page with a tab switcher. Why:
the Log view is expected to grow long (one entry per ticket run, every
night) and deserves its own scroll/filter state without fighting the
Trends page's chart layout for space. "Open one page each morning" also
reads more naturally as a URL than a tab state.

A third route, Methodology, existed in the first draft (freeform
long-form case-study writeups) and was cut in review — see "Methodology
→ comments" below. Nav is two items: Trends, Log. `index.html` is the
default landing route.

## Trends view: both altitudes, kept lean

Trends holds both an aggregate/trend altitude (stat tiles, charts) and a
per-run altitude (drill-down table) rather than splitting them across
pages — the tracked metrics span both, and splitting would duplicate the
same data two ways.

**Cut in review** (all per direct feedback, not a design guess):
- **Cache read:write ratio chart** — not a metric Alex actually wanted
  tracked day-to-day.
- **Cost-vs-human-hour-equivalent tier boxes** — no defined methodology
  behind the multiplier yet; shipping it as a headline stat implied more
  rigor than it had.
- **Intro-vs-standard-pricing toggle** — this came from the gate-stub's
  own mockup brief text (written before the review session, not something
  discussed live) and Alex didn't want it once surfaced.
- **`manually_inspected` flag** (bar-chart warning icon, drill-down badge)
  — invented as flavor without a real capture mechanism. Neither T-046's
  hook nor T-053's schema has a field for it. Cut until that mechanism is
  actually designed as its own ticket; it now only survives as an example
  inside a Log comment (illustrating what the *comment* feature is for,
  not as dashboard chrome of its own).

**Added in review**, to keep the remaining Trends content well-populated
once the above was cut:
- A per-tier (S/M/L) granularity row — avg cost, avg tokens, run count —
  directly under the stat tiles.
- A `Retries` column on the drill-down table.
- The cost-vs-diff-size chart went from loosely-positioned dots to a real
  chart: axes, gridlines, a fit line, labeled ticks.

**Charting approach:** the mockup's cost-vs-diff-size and tokens-per-run
charts are hand-built SVG/CSS. Alex decided (2026-07-26) the *real*
implementation (T-057) should use an actual charting library (`recharts`,
matching `apps/web`'s React stack) rather than carrying the hand-rolled
approach forward — more reliable rendering, and axes/gridlines/tooltips
come for less hand-authored code.

**Filter buttons are functional in the mockup**, not just visual toggles
— clicking a time-range or the exclude-empty-runs button actually
re-renders the charts/table against different (fixture) data. One caveat
Alex caught: the mockup's fixture-data approach multiplies one fixed set
of tickets by a range factor rather than substituting a genuinely
different set of runs per range, so the aggregate stats (avg cost, avg
turns) don't move independently of the token/cost numbers the way real
data would. This is a mockup-only shortcut — T-057 queries M-OBS.4's
real endpoint per range and doesn't inherit the problem, since a
different date range naturally returns a different set of real runs.

**Layout bug found and fixed in review:** the drill-down table's rows
were each rendered as an independently-laid-out nested `<table>` inside
their `<details><summary>`, so their column widths weren't tied to the
header row's — they visibly drifted out of alignment as the browser
window resized. Fixed by giving the header row and every data row the
*same* CSS Grid column template (`minmax()`/`fr` units) instead of nested
tables, so alignment holds at any width. Verified in the mockup at
1000px/1400px/1800px. **T-057's ticket explicitly calls this out** as a
pattern to carry into the real React implementation — the same mistake
(each row laying itself out independently) is easy to reintroduce with a
naive per-row component.

## Responsive scope: desktop-only, but must hold across desktop widths

This is a desktop tool Alex opens each morning — no mobile breakpoint was
designed or is expected to be needed. That's different from "doesn't need
to be responsive at all," though: the layout (especially the drill-down
table, per the bug above) must stay correctly aligned as a desktop browser
window is resized, not just at one fixed width. T-057/T-058 both carry
this as an explicit exit-condition check, not just a design aspiration.

## Methodology → comments on Log entries

The original Methodology route (long-form case-study writeups, authored
by Alex after an instructive run) was replaced entirely, not kept
alongside the new feature. Alex's actual want, once the mockup made the
tradeoff concrete: comment directly on individual Log entries, rather
than writing separate freestanding essays — and ideally have an agent
able to post its own comment too (e.g. a reviewer subagent flagging
something worth Alex's attention on a specific run).

**What's actually ticketed for v1:** Alex-authored comments only
(T-059's write endpoint, T-058's UI). Agent-authored comments are
explicitly deferred — Alex's call (2026-07-26) was to get real usage of
manual commenting first, then decide the posting mechanism (same-session
reviewer subagent vs. a separate on-demand pass) once there's a concrete
sense of what's worth an agent flagging. T-059's `author` column is
free-text specifically so adding that later doesn't require a schema
change, but no second caller is wired up in this milestone.

The mockup itself still shows an example agent-authored comment (on the
G-010 entry) — kept as a visual reference for what the future capability
should look like, not as something T-058 needs to build.

## Design-system reuse vs. divergence

**Reused as-is:** four-plane depth system (void/surface/elevated/focal),
full color token set, type scale (display for headings, body for prose,
mono for all numeric/ID data), spacing scale, radius scale, button
patterns (§7.7), tag/pill patterns (§7.8), empty-state tone (§8.2, no
mascot).

**Deliberately not reused:** entity-color system (NPC/faction/location/
item/arc) and the mascot system — both are specific to the campaign-content
product; using them here would miscategorize this as a QuestLog-the-app
feature rather than QuestLog-the-project tooling. The top-nav chrome (nav
buttons in the header, not the app's rail+panel grid) reflects the same
distinction — this is a standalone tool, not a screen inside the RPG app.

**Capitalization fix, applied at large:** the first mockup draft mixed
casing conventions — outcome badges rendered lowercase ("shipped") next
to verdict badges rendered uppercase ("PASS"). Fixed at the CSS level
(`.badge { text-transform: uppercase }`, matching the `.tag` pattern
already used for tier badges) rather than by hand-fixing individual
strings, so markup can stay natural-case and rendering can't drift back
out of sync. Section titles were also normalized to consistent Title Case.

## What this mockup does not resolve

- Real chart implementation details beyond "use `recharts`" — exact
  component structure, tooltip content, and responsive container sizing
  are T-057's to work out against real data.
- The agent-comment posting mechanism (see above) — explicitly deferred,
  not designed here.
- Mobile/phone layout — out of scope entirely, not deferred (see
  "Responsive scope" above).
