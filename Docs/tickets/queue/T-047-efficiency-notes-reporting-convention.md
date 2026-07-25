# T-047 — Efficiency-notes reporting convention

Milestone ref: M-OBS.2

Branch: feat/m-obs/t-047-efficiency-notes-reporting-convention

Context files (load ONLY these):
  - Docs/tickets/REPORT_TEMPLATE.md
  - Docs/tickets/BLOCKED_TEMPLATE.md
  - Docs/tickets/EXECUTOR_ROUTINE.md

Mockup: none

Model: sonnet

Scope: T-046 captures *objective* per-run data (tokens, theoretical cost, duration). This ticket adds the *subjective* half: a required "## Efficiency notes" section where the executor self-reports, in its own words, why a run ran long or stayed tight — the kind of thing only the agent doing the work can know (e.g. "given superfluous frontend context on a backend-only ticket", "had to refactor a non-standard existing pattern before the new implementation could proceed"). Concretely:
  - Add "## Efficiency notes" to `REPORT_TEMPLATE.md`'s report shape, positioned after "Reviewer verdict" and before "Anything Alex must decide". Include 2-3 short example prompts/phrasings (reusing the two examples above) so the convention is concrete, not "reflect on efficiency" left vague.
  - Add the same section, adapted for the blocked case, to `BLOCKED_TEMPLATE.md` — a blocked run that burned its full iteration cap before giving up is at least as interesting a data point as a shipped one, and skipping it would leave a real gap in exactly the data this system exists to collect.
  - Update `EXECUTOR_ROUTINE.md` Step 7 (and Step 6, for the blocked path) to explicitly instruct writing this section as part of the existing report-writing step — one line each, not a new step.
  - A short pointer note (one line) in `REPORT_TEMPLATE.md` that this section is the qualitative half of the observability system T-046 provides the quantitative half of — do not duplicate T-046's mechanics here.

Out of scope:
  - No changes to T-046's hook, schema, or JSON artifact shape.
  - No retroactive efficiency notes for already-`done`/`blocked` tickets — this only applies going forward.
  - No new template file — this amends the two existing ones in place.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean (no code touched by this ticket; this confirms no regression)
  - `grep -q "## Efficiency notes" Docs/tickets/REPORT_TEMPLATE.md` and the same against `Docs/tickets/BLOCKED_TEMPLATE.md` both succeed
  - `grep` against `Docs/tickets/EXECUTOR_ROUTINE.md` confirms Step 7 (and Step 6) explicitly reference the efficiency-notes section by name

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
