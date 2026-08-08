# T-133 — /drift-audit weekly report command

Companion to `T-132-bootstrap-drift-audit.md`. That ticket runs the
first-ever, full-history audit interactively and seeds
`Docs/tickets/DRIFT_AUDIT_STATE.md`. This ticket builds the reproducible
command that runs weekly against that (and each subsequent) state marker,
producing a read-only findings report — no fixes, no ticket filing, no
code changes. Alex reviews the emailed report and works through findings
live in a follow-up interactive session; that live session is explicitly
out of scope here.

Milestone ref: cross-cutting pipeline tooling (ad hoc — not extracted from
  a milestone doc task; companion to T-132, born from the same interactive
  planning session that retired T-017)

Complexity tier: D

Strategy-gate flag: no

Priority: P2

Branch: chore/m-pipeline/t-133-drift-audit-command

Context files (load ONLY these):
  - .claude/commands/lineup.md (structural precedent: an existing
    read-only, scheduled-safe slash command with its own "Setting this up
    as a routine" section pointing at the `schedule` skill /
    `mcp__scheduled-tasks__create_scheduled_task` — this ticket follows
    the identical delivery pattern, just weekly instead of daily and with
    a real findings payload instead of a queue snapshot)
  - Docs/tickets/queue/T-132-bootstrap-drift-audit.md (the 7 audit
    dimensions this command re-runs on a diff basis, and the state-file
    consumer contract this ticket is the producer/definer of)
  - Docs/tickets/TICKET_SPEC.md (ticket format conventions the report
    should stay legible against — e.g. how findings reference files)
  - .claude/rules/*.md (what the audit checks code against)
  - Docs/IMPLEMENTATION_NOTES.md

## Relevant background
excerpted from `.claude/commands/lineup.md`, as of 2026-08-06

> To have this delivered automatically each morning, add a scheduled task
> (via the `schedule` skill or `mcp__scheduled-tasks__create_scheduled_task`)
> with a routine description along these lines:
>
> > Run `/lineup` in the QuestLog repo (`/Users/alexandermeyer/Documents/Code/QuestLog`)
> > and send me the resulting report. Daily on weekday mornings.
>
> Adjust the time/days to taste. This command is read-only, so it's safe
> to run even on a day nothing changed — the worst case is a report
> saying the lineup looks the same as yesterday.

`/drift-audit` follows this same pattern: build a plain slash command,
verify it works standalone, and document (in its own "Setting this up as
a weekly routine" section, mirroring `lineup.md`'s) how Alex points a
`schedule`-skill task at it — `Run /drift-audit in the QuestLog repo and
send me the resulting report. Sundays at 10am.` Actually wiring up the
scheduled task is a manual step Alex performs after this ticket ships
(same as `/lineup`'s own doc says for itself) — it is not part of this
ticket's Exit condition.

Mockup: none

Model: sonnet

Scope:
  1. Define the state-marker format at `Docs/tickets/DRIFT_AUDIT_STATE.md`:
     a small, git-tracked, human-and-machine-readable file recording at
     minimum the last audit's completion git SHA, its date, and a pointer
     to its report file, e.g.:
     ```markdown
     # Drift Audit State

     Last audit: 2026-08-06
     Last audit SHA: <full commit SHA>
     Last audit report: Docs/tickets/reports/T-132-bootstrap-drift-audit.md
     ```
     `T-132` seeds the first version of this file; this ticket's command
     reads and rewrites it each run. Keep the format dead simple (no JSON
     ceremony) — it only ever needs one consumer (this command) and one
     producer (this command, plus T-132's one-time seed).
  2. Write `.claude/commands/drift-audit.md`, structured like
     `.claude/commands/lineup.md` (frontmatter description, numbered
     Procedure, explicit "what this command does not do" section):
     - Step 0: `git fetch origin develop`; read
       `Docs/tickets/DRIFT_AUDIT_STATE.md` off `origin/develop` (`git show`,
       same pattern `lineup.md:9` uses — never a working-tree read). If the
       file doesn't exist yet (T-132 hasn't run), say so explicitly in the
       report and stop cleanly rather than erroring or guessing a
       full-history scope.
     - Step 1: resolve the commit range to audit — everything merged into
       `develop` between the state marker's `Last audit SHA` and current
       `origin/develop` HEAD (`git log <sha>..origin/develop`). If the
       range is empty (nothing merged since last run), the report says so
       explicitly and still completes normally (per `lineup.md`'s own
       "safe to run even on a day nothing changed" precedent) — this is
       not an error case.
     - Step 2: run the same 7 audit dimensions T-132's Scope defines,
       scoped to only the files/commits touched in that range — not a
       full-repo re-walk. (Rules-file accuracy and IMPLEMENTATION_NOTES.md
       hygiene checks may need to read the full current file regardless,
       since "does this doc still describe current behavior" isn't
       diff-scopable the same way "did this PR introduce a one-off
       pattern" is — use judgment per dimension rather than forcing every
       check through the same diff lens.)
     - Step 3: render one plain-markdown report, deliberately
       copy-paste-friendly (no tables where a bullet list reads fine
       pasted into a chat, no collapsed sections) — Alex's stated intent
       is pasting this directly into a follow-up interactive session.
       Include: date, commit range audited, one section per dimension
       (concrete findings with file/line refs, or explicit "nothing
       found"), and a short summary line up top ("N findings across M
       dimensions" or "clean — nothing found").
     - Step 4: **strictly read-only against the codebase** — no inline
       fixes, no `Docs/tickets/backlog/` ticket filing, no code edits.
       The only repository mutation permitted is step 5 below.
     - Step 5: commit (directly to `develop`, small docs-only commit, no
       PR — same category as the existing `chore: remove stale duplicate
       T-081` pattern already used for small pipeline housekeeping)
       an updated `Docs/tickets/DRIFT_AUDIT_STATE.md` pointing at this
       run's SHA/date, plus the rendered report saved to
       `Docs/tickets/reports/drift-audit-<YYYY-MM-DD>.md` for a durable
       paper trail independent of the email.
     - Step 6: deliver the report the same way `/lineup` does — as the
       scheduled task's own response, so whatever delivery channel Alex
       configures the scheduled task with (per the "Relevant background"
       excerpt above) handles getting it to alexmeyer@awmdevelopment.com.
       Do not build custom mailer/SMTP infrastructure in
       `apps/server` or anywhere else in the app codebase — none exists
       today (confirmed: no sendgrid/nodemailer/ses/smtp/mailgun/resend
       references anywhere under `apps/`, `packages/`) and this command
       has no reason to be the first thing that adds one.
  3. Add a "Setting this up as a weekly routine" section to
     `drift-audit.md` mirroring `lineup.md`'s, adjusted for weekly/Sunday
     10am cadence and this command's name.

Out of scope:
  - Building or wiring the actual scheduled task (`mcp__scheduled-tasks__create_scheduled_task`
    call, or equivalent `schedule`-skill setup) — that's a manual step
    Alex performs after this ticket ships, exactly as `/lineup`'s own docs
    already treat their own scheduling setup.
  - Any inline fix, ticket filing, or code change based on findings — this
    command only ever reports.
  - Building outbound-email/mailer infrastructure — delivery rides the
    scheduled-task mechanism, not new app code.
  - Re-running or modifying T-132's one-time bootstrap audit logic — this
    ticket only consumes the state file T-132 seeds; it doesn't redefine
    the audit dimensions, just applies them diff-scoped.
  - Changing the 7 audit dimensions themselves — if a future audit finds
    the dimension list itself needs to change, that's a decision for an
    interactive session (same self-audit-risk reasoning as T-132/T-017),
    not something this command should do autonomously.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - Given a hand-built fixture repo state with a seeded
    `DRIFT_AUDIT_STATE.md` pointing at a known older SHA and at least one
    deliberately-introduced drift case per dimension (e.g. a service
    skipping `withErrorHandling`, a stale `.claude/rules/` claim, an
    orphaned export), running `/drift-audit` against that fixture produces
    a report correctly flagging each seeded case and updates
    `DRIFT_AUDIT_STATE.md` to the new SHA/date — no fixture case is
    silently missed, and no fix/ticket-filing side effect occurs anywhere
    in the fixture.
  - Running it a second time immediately after (no new commits) produces
    a "clean — nothing found since last run" report and still completes
    without error.
  - Running it against a fresh checkout with no `DRIFT_AUDIT_STATE.md`
    present produces the explicit "hasn't been bootstrapped yet" message
    from Step 0, not a crash or a silently-wrong full-history guess.

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in the relevant milestone
  doc if one applies (none does here — mark N/A),
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made
  (e.g. why the state-marker format was kept deliberately simple, or any
  diff-scoping subtlety found while building the per-dimension diff
  logic), a CHANGELOG.md entry under [Unreleased], morning report written.
