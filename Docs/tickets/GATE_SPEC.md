# Gate Spec

**Location:** `Docs/tickets/GATE_SPEC.md`
**Last Updated:** 2026-07-23
**Purpose:** The exact format for a gate-stub — a placeholder for work that's blocked on a human decision (🎨 design or 🧠 strategy), not on a code dependency. `.claude/skills/ticket-writer/SKILL.md` and `EXECUTOR_ROUTINE.md` both file these; `.claude/skills/ungate/SKILL.md` (the `/ungate` command) is the only thing that resolves them. See `TICKET_SPEC.md`'s `Gated on:` field for how a ticket references one.

Every gate-stub lives at `Docs/tickets/gated/G-###-slug.md` (`###` sequential, zero-padded, never reused — its own sequence, separate from tickets' `T-###`, since a gate-stub isn't yet an executable unit of work and shouldn't consume a ticket number before it becomes one — see "Claiming a number" below for how a filer picks `###` without colliding with a concurrent session) and contains exactly these fields, in this order:

```markdown
# G-### — <title>

Gate type: 🎨 design | 🧠 strategy

Milestone ref: <Docs/milestones/MILESTONES_V1_MCP.md section>

Opened: <date> — <by Alex/agent during planning | filed by the executor mid-run on T-###>

Context files (load ONLY these):
  - <explicit file path or PRD §ref — never "the whole PRD">
  - ...

Open question: <the exact decision needed — not "figure out OCR", but
  "which OCR approach: local Tesseract vs. hosted API, and what
  cost/latency tradeoff are we willing to accept?">

Blocks: <milestone task ref(s) and/or ticket id(s) waiting on this decision —
  "none yet" if the gate was filed before anything downstream exists>

Notes: <anything already surfaced — options considered, partial
  exploration, why a ticket in flight had to skip this>
```

## Field notes

- **Gate type** — 🎨 means the resolution is a mockup (`Docs/mockups/<view>/`); 🧠 means the resolution is a written decision with rationale. Same taxonomy `AGENTS.md`'s hard rules and `Docs/milestones/MILESTONES_V1_MCP.md` already use — a gate-stub doesn't invent a new gate concept, it just gives the existing one a durable home before it's resolved.
- **Opened** records provenance because gate-stubs have two distinct origins (see Lifecycle below) and `/ungate` needs to know which ticket, if any, is already mid-flight and waiting.
- **Context files** is the same discipline as a ticket's — the whole point of deferring this to a dedicated `/ungate` session is that it gets Alex's full attention on just this decision, not a grab-bag of "whatever's related."
- **Open question** must be a single, answerable question — same bar as `BLOCKED_TEMPLATE.md`'s "Exact question for Alex." "Should we support OCR?" is not answerable; "local Tesseract vs. hosted API, given a cost ceiling of $X/mo" is.
- **Blocks** is what `/ungate` uses to find everything it needs to unblock on resolution — every milestone task and every ticket carrying a matching `Gated on: G-###` should be named here. `ticket-writer` and the executor are responsible for keeping this list current when they file or update a gate-stub; `/ungate` also sweeps independently (see "Keeping tickets and gates in sync" below) as a safety net against a missed reference. Every milestone task named here also carries a matching `(Gated on: G-###)` tag on its own line in the milestone doc — see `TICKET_SPEC.md`'s "Milestone-doc annotations" for the full convention and `/ungate`'s obligation to clear that tag on resolution.

## Claiming a number

Filing a gate-stub is otherwise a look-then-act operation — scan every existing `G-###` file across `gated/` and `gated/resolved/`, take the highest number, use the next one — with nothing in between to stop two concurrent sessions computing the same number (the exact `G-012`/`G-013` collision — see `gated/resolved/G-013-documentation-duplication-reduction-strategy.md`'s Renumbered note). **Run that scan from the filing session's own isolated worktree (already established by `T-069`/`T-070` before any of `ticket-writer`, `/ungate`, or `EXECUTOR_ROUTINE.md` reaches this point) or from `origin/develop` directly — never against the shared primary directory's live working tree**, which can be checked out to any branch at the instant you look and has already caused a missed collision for the equivalent `T-###` case (`ticket-writer` step 6's note on `T-145`: a branch with a ticket file committed locally but never pushed). Fix mirrors `T-069`'s claim-by-push (`EXECUTOR_ROUTINE.md` Step 2): **claim the number immediately upon choosing it**, before drafting any of the gate-stub's real content. Commit a placeholder file at `Docs/tickets/gated/G-###-slug.md` containing only the header line (`# G-### — <working title>`) and **push it** — `git push` (to the filing session's own branch). A commit alone is not enough: every filer works in its own git worktree (`T-069`), so an unpushed commit is invisible to a concurrent session's directory scan the same way an uncommitted file was in the `G-012`/`G-013` incident — only the push makes the claim a real mutex instead of a check-then-act race with a different name. Once pushed, fill in the rest of the fields in place and commit/push again once the gate-stub is complete. A second session's scan, run any time after the placeholder is pushed, sees it and picks the next number instead of colliding. If the drafting session is abandoned before finishing, the placeholder is harmless — a near-empty file, easily overwritten by whoever picks the number up for real, or cleaned up by hand. Both filing sites — `ticket-writer` step 3 and the executor's `EXECUTOR_ROUTINE.md` Step 3 — follow this convention; neither hardcodes its own copy. (`EXECUTOR_ROUTINE.md` Step 3 already pushes its ticket branch once at Step 2's claim-by-push — filing a gate-stub mid-ticket per this convention means pushing again immediately after the placeholder commit, the same "second push to the branch" pattern Steps 6/7 already use for the same reason.)

## Lifecycle

`Docs/tickets/gated/` sits outside the ticket pipeline (`TICKET_SPEC.md`'s `backlog/` → `queue/` → `in-progress/` → `done/`/`blocked/` flow) — it feeds it, the way a spring feeds a river. A gate-stub is created two ways:

1. **During planning** — `.claude/skills/ticket-writer/SKILL.md`, drafting tickets from a milestone task, hits an unresolved 🎨/🧠 gate. Instead of stopping the whole session to resolve it inline (the old behavior), it files a gate-stub here, notes the milestone task in `Blocks:`, and continues drafting whatever else in the milestone doesn't depend on it.
2. **Mid-execution** — the nightly executor (`EXECUTOR_ROUTINE.md` Step 3) hits an unresolved 🧠 gate on one scope item within an otherwise-shippable ticket. It still ships what it can (per `AGENTS.md`'s existing rule), but now *also* files or updates a gate-stub here — referencing the ticket id and branch in `Blocks:`/`Notes:` — instead of leaving the gap to be rediscovered only in the morning report.

`/ungate` (`.claude/skills/ungate/SKILL.md`) is the only mechanism that resolves a gate-stub. `/ungate` always pulls the earliest open `G-###` in numeric order — gates have no priority tier of their own (`G-010`'s `Priority` field lives on tickets only), so this stays pure "oldest first, no cherry-picking" the way ticket selection itself used to before `G-010` — predictable order that doesn't depend on whoever happens to run the command noticing a different one first.

On resolution, `/ungate`:
- Makes the decision with Alex (produces a mockup for a 🎨 gate; records rationale for a 🧠 gate).
- Finalizes or drafts every ticket named in `Blocks:`, landing each in `queue/` (or `backlog/` if it separately carries its own unresolved `Blocked on:` merge dependency) — following `TICKET_SPEC.md` exactly, same as `ticket-writer` would.
- Sweeps `backlog/`, `queue/`, and `in-progress/` for any other `Gated on: G-###` reference to this same id that `Blocks:` missed, and clears those too.

A resolved gate-stub is never deleted — `git mv` it to `Docs/tickets/gated/resolved/G-###-slug.md` with a `## Resolution (<date>)` section appended recording the decision, mirroring `TICKET_SPEC.md`'s WON'T-FIX convention for tickets (a durable record of "resolved," not silent removal).

## Keeping tickets and gates in sync

A ticket can carry a `Gated on: <gate-id>` field (`TICKET_SPEC.md`) marking it as blocked on a decision rather than a merge. This is **deliberately asymmetric** with `Blocked on:`, and that asymmetry is the one thing every piece of this pipeline must respect:

- `Blocked on:` is auto-cleared by the nightly executor's pre-flight the moment its named ticket(s) land in `done/` — no human step needed.
- `Gated on:` is **never** auto-cleared by the executor. It is cleared exclusively by `/ungate`, because clearing it means a real decision got made, and no automated process is allowed to manufacture one.

Concretely, this means:

- The executor's backlog-promotion check (`EXECUTOR_ROUTINE.md` Step 1) must verify a ticket has **no** `Gated on:` line before promoting it to `queue/`, in addition to its existing `Blocked on:` check. A ticket with both fields stays in `backlog/` until *both* clear, even if `Blocked on:` clears first.
- If the executor ever encounters a `Gated on: G-###` reference where `G-###` no longer exists under `gated/` (i.e., it was resolved and moved to `gated/resolved/` but this reference was missed), that is a sync bug, not a green light — the executor logs it as an anomaly for Alex to check by hand rather than either promoting the ticket or silently ignoring the stale reference.
- `ticket-writer` and the executor, when filing a gate-stub, are responsible for listing every ticket/milestone task they know depends on it in `Blocks:` — but `/ungate`'s independent sweep (above) exists precisely because "responsible for" isn't a guarantee. Treat the sweep as the actual safety net, not the `Blocks:` list.
