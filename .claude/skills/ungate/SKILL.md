---
name: ungate
description: Resolve the earliest open gate-stub in Docs/tickets/gated/ — an interactive session with Alex to make the 🎨/🧠 decision it's blocked on — then generate real tickets into the automated pipeline and clear anything waiting on it. Invoked as "/ungate".
---

# Ungate

Resolves exactly one gate-stub: the earliest `G-###` under `Docs/tickets/gated/`. This is an interactive-session skill, run with Alex present — never picked up by the automated nightly executor, since the whole point is that a 🎨/🧠 decision needs Alex, not an agent guessing. Sonnet is fine for this by default, same as everything else; switch to a heavier model yourself if a specific gate's decision warrants it. Where `ticket-writer` turns a resolved milestone task into tickets, `/ungate` turns an *unresolved* gate into a resolved one, then does the same ticket-drafting `ticket-writer` would have done at the time, now that the decision exists.

## Inputs you need before starting

1. `Docs/tickets/gated/*.md` — list it and pick the lowest `G-###`. If empty, report `NO_GATE_OPEN` and stop; do not read anything else.
2. `Docs/tickets/GATE_SPEC.md` — the format you're reading and (at the end) rewriting.
3. `Docs/tickets/TICKET_SPEC.md` — the format for whatever ticket(s) this resolution produces.

## Procedure

0. Make sure the session is on a gate-resolution branch, not whatever it started on: `gates/<gate-slug>` (e.g. `gates/g-004-ocr-approach`), cut from `develop`. Docs-only (plus a mockup, for a 🎨 gate) — PR'd into `develop` like ticket-creation branches, using a distinct prefix for the same reason `tickets/*` is distinct from `feat/*`: a `git branch -a` scan should show gate-resolution PRs apart from both ticket-planning and ticket-implementation PRs at a glance.
1. List `Docs/tickets/gated/*.md`, sort by `G-###` numerically, pick the lowest. **Always the earliest — never cherry-pick a later one**: gates have no priority tier (unlike tickets since `G-010` — see `TICKET_SPEC.md`'s `Priority` field), so this stays pure oldest-first: predictable order, no incentive to dodge the oldest open question.
2. Read the gate-stub in full, then exactly its `Context files:` list. Read the `Blocks:` field to know which milestone tasks and/or tickets are waiting.
3. Work the `Open question:` to an actual decision, together with Alex. This is the reason the gate exists — do not invent an answer and do not proceed past this step without one.
   - **🎨 gate**: produce (or confirm an already-drafted) mockup at `Docs/mockups/<view>/` (index.html + screenshot.png + NOTES.md), per the usual mockup convention. The mockup *is* the resolution — once it exists, the gate is cleared the same way a ticket referencing a mockup is never visually gated (`CLAUDE.md`).
   - **🧠 gate**: record the decision and its rationale in this conversation plainly enough to draft real Scope/Exit-condition fields from it. If Alex isn't ready to decide this session either, stop here — leave the gate-stub untouched in `gated/`, report `G-### still open — <why>`, and do not proceed to step 4.
4. Now that the decision exists, resolve every consumer named in `Blocks:`:
   - **A `backlog/` ticket already exists with `Gated on: G-###`** (this gate-stub's own id): finalize its Scope/Out-of-scope/Exit-condition using the new decision, delete the `Gated on:` line, and `git mv` it to `queue/` — unless it *also* carries an unresolved `Blocked on:`, in which case leave it in `backlog/` with only `Blocked on:` remaining. On the milestone doc, strip the `, Gated on: G-###` suffix from that task's tag, leaving just `(T-###)` (`TICKET_SPEC.md`'s "Milestone-doc annotations").
   - **No ticket exists yet for a named milestone task**: draft it now, following `.claude/skills/ticket-writer/SKILL.md`'s procedure and `TICKET_SPEC.md`'s format exactly (same sizing rule, same field discipline), landing it in `queue/` or `backlog/` as that procedure dictates. Replace that task's `(Gated on: G-###)` tag with `(T-###)` on the milestone doc — same tagging obligation `ticket-writer` itself has when it drafts a ticket.
5. **Sync safety net** — independently grep all of `backlog/`, `queue/`, and `in-progress/` for `Gated on: G-###` (this gate's id), including any match `Blocks:` didn't already name. Clear every one the same way as step 4. Also grep every milestone doc for a `(Gated on: G-###)` tag with this same id — clear it the same way (strip the suffix if a `(T-###)` tag is already present alongside it, or replace it with a freshly drafted ticket's `(T-###)` if not). Do not assume `Blocks:` was exhaustive — `GATE_SPEC.md`'s "Keeping tickets and gates in sync" treats this sweep as the actual guarantee, not the `Blocks:` list.
6. If the decision is durable and non-obvious enough to matter beyond this one gate, add a pointer to `Docs/IMPLEMENTATION_NOTES.md` (one line, per `CLAUDE.md`'s "WHY only, once" comment rule — the full rationale lives on the gate-stub's resolution, not duplicated in both places).
7. Append `## Resolution (<date>)` to the gate-stub recording the decision and its rationale, then `git mv` it from `Docs/tickets/gated/G-###-slug.md` to `Docs/tickets/gated/resolved/G-###-slug.md`.
8. Commit the branch's changes. Do not open a PR by hand-waving — same as `ticket-writer`, this is docs-only (plus a possible mockup) work, PR'd into `develop` through the normal review flow.
9. Report back: the gate id and its resolution, every ticket created or promoted (and where each landed), every milestone task line whose tag was updated (`(Gated on: G-###)` → `(T-###)`, or the suffix stripped), any `Gated on:` reference the step-5 sweep caught that `Blocks:` had missed, and whether any other open gate-stub remains for a future `/ungate` run.

## What this skill does not do

- Does not implement any application code — this is a planning-shaped session, same as `ticket-writer`, not an execution one.
- Does not resolve more than one gate per invocation. Run `/ungate` again for the next one.
- Does not touch `Docs/mockups/` beyond producing/confirming the asset for the gate it's actively resolving.
- Does not promote a ticket whose *other* dependencies (a separate `Blocked on:`) aren't yet clear — clearing `Gated on:` is not the same as clearing everything.
- Does not invent a decision Alex hasn't actually made. A session that can't reach a decision ends with the gate-stub still open, not a guessed answer forced through to unblock the pipeline.
