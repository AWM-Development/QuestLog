# G-027 — External visibility surfaces: Slack delivery + ticket-tracker mirror

Gate type: 🧠 strategy

Milestone ref: M-ROBUST.2 (`Docs/milestones/MILESTONES_V1_5_MCP.md`)

Opened: 2026-08-02 — by Alex, filed as part of `G-020`'s Q4 follow-through.

Context files (load ONLY these):
  - Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Resolution (Q4)
  - Docs/tickets/COMMANDS.md (`/lineup`, `/ungate` — the commands whose
    output would become a Slack payload)
  - Docs/tickets/TICKET_SPEC.md § Lifecycle (the "repository is the source
    of truth" commitment a tracker mirror must not reverse)

Open question: Two related candidates, grouped under one gate because both
  are "make pipeline state visible outside the repo" and resolving one may
  inform the other's shape — split back into separate gates during
  `/ungate` if they turn out unrelated in practice:
  (a) **Slack** — which events get delivered (`/lineup`'s daily summary, a
  blocked-run alert, possibly an `/ungate` prompt when a gate opens); push
  (webhook on event) vs. a scheduled digest; is provisioning a Slack
  app/bot token worth doing now given nothing is currently installed
  anywhere?
  (b) **External ticket tracker (Linear/Jira)** — is a *mirror* of
  `Docs/tickets/` worth building at all, given the pipeline's design
  already commits `Docs/tickets/` as sole canonical source
  (`TICKET_SPEC.md`'s Lifecycle section)? If yes: one-way sync (repo →
  tracker, read-only externally) or something richer; which tool; and does
  the sync run on the same event/cron cadence `G-029` is separately
  deciding for CI-event triggers?

Blocks: none yet — M-ROBUST.2 not yet drafted.

Notes: Raised in `G-020` Q4 verbatim: "Slack (delivery of `/lineup`,
  blocked-run alerts, and possibly `/ungate` prompts — not currently
  installed anywhere); an external ticket tracker (Linear/Jira — and if so,
  is it a *mirror* of `Docs/tickets/` or does it displace the files as
  canonical, which would be a reversal of the pipeline's central design
  choice)." Both are lower-priority "visibility" surfaces with a shared
  "push vs. mirror, and how much" shape, hence the grouping.

## Resolution (2026-08-22)

Declined building either surface, at least for now. Alex confirmed directly,
  no split needed between the two candidates — both are out for the same
  underlying reason (added surface/sync cost with no clear gap over what
  already exists), not two independently-reasoned decisions:

- **(a) Slack** — not installed anywhere in this pipeline today, and
  provisioning a Slack app/bot token purely to deliver `/lineup`/blocked-run/
  `/ungate` events wasn't judged worth doing yet. `/lineup` and the morning
  report already surface this state interactively; a push channel is a
  "nice to have," not a gap blocking anything.
- **(b) External ticket tracker mirror** — declined outright, not just
  deferred on tooling choice. `TICKET_SPEC.md`'s Lifecycle section already
  commits `Docs/tickets/` as the pipeline's sole canonical source; even a
  strictly one-way (repo → tracker, read-only externally) mirror adds a
  second surface that can drift or need reconciling, for a benefit
  (external visibility) nothing currently needs — nobody but Alex reads
  this pipeline's state, and Alex already has the repo.

`M-ROBUST.2` (`Docs/milestones/MILESTONES_V1_6_MCP.md`) closed WON'T FIX,
  no ticket drafted — same disposition `G-028`/`G-029` used for their own
  declined candidates. Revisit only if a real second consumer of pipeline
  state shows up (e.g. a collaborator who isn't reading the repo directly),
  not on a schedule.
