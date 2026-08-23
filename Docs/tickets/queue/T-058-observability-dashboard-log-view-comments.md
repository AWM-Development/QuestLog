# T-058 — Observability dashboard: Log view + comments

Milestone ref: M-OBS.5

Priority: P2

Branch: feat/m-obs/t-058-observability-dashboard-log-view-comments

Context files (load ONLY these):
  - Docs/mockups/observability-dashboard/log.html
  - Docs/mockups/observability-dashboard/shared.css
  - Docs/mockups/observability-dashboard/NOTES.md
  - Docs/tickets/BLOCKED_TEMPLATE.md (the blocked-report shape the Log
    view's blocked-entry rendering mirrors — what was attempted, why it
    stopped, exact question for Alex)

Mockup: Docs/mockups/observability-dashboard/ (log.html is the Log route)

Model: sonnet

Scope: Add the Log route (`/log`) to the `apps/observability-dashboard`
  app shell T-057 creates, per `log.html`'s mockup:
  - Reverse-chronological ticket-run feed. Each entry shows ticket id +
    title, complexity tier badge, outcome badge (shipped/blocked),
    reviewer-verdict badge, one-line summary, cost/tokens. Expands (same
    `<details>`-style pattern as the mockup) to the full report: test
    evidence, exit-condition checks, reviewer's verbatim verdict,
    efficiency notes (including the cause-categorized retry log), and
    "anything Alex must decide." Blocked entries use distinct
    `status-error` styling and swap in the blocked-report shape (what was
    attempted, why it stopped, an "Exact question for Alex" callout)
    instead of the shipped shape.
  - Outcome filter (all/shipped/blocked), functional against the fetched
    data, not just a visual toggle.
  - **Comment thread per entry**, per the mockup: existing comments
    listed (author chip + timestamp + body) plus a textarea + "Add
    Comment" control that posts to T-059's write endpoint and appends the
    new comment to the thread on success. Alex-authored comments only —
    see Out of scope.
  Fetches from M-OBS.4's endpoint(s) (T-054/T-055) for run/report data and
  T-059's endpoint for comment read/write.

Out of scope:
  - Trends view — T-057, already shipped by the time this ticket runs.
  - Methodology / long-form case-study writeups — cut during mockup
    review with Alex (2026-07-26) in favor of comments directly on Log
    entries; no separate route replaces it.
  - Agent-authored comments — deferred. Alex decided (2026-07-26) to ship
    Alex-only commenting first and design the agent-authoring mechanism
    (same-session reviewer subagent vs. a separate on-demand pass) once
    there's real usage of manual comments to inform it. The comment data
    model (T-059) should not need to change shape when that lands — an
    `author` field distinguishing "alex" from an agent identity is enough
    groundwork — but building the posting mechanism itself is not this
    ticket's job.
  - Editing or deleting existing comments — append-only for v1.
  - `manually_inspected` badge — no capture mechanism exists yet; cut from
    this route along with Trends (T-057).
  - Any change to M-OBS.4's endpoint shape — this ticket consumes it as-is.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - Log route renders a seeded blocked-outcome fixture with its "Exact
    question for Alex" callout visible
  - submitting the comment form against a seeded entry calls T-059's write
    endpoint and the new comment appears in the thread without a full page
    reload
  - the outcome filter actually narrows the rendered entry list against
    the fetched data (assert on the DOM, not just button active-state)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
