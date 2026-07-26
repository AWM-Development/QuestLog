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
  - **Within that section, also require a structured retry log**: for each Red/Green iteration in Step 4 that failed and triggered a retry (i.e. each "distinct approach" counted against the ticket's iteration cap), record a cause category — `environment_setup` (DB/config/tooling problem, not the ticket's own logic), `mechanical_lint_typecheck` (a lint/typecheck failure, not a test failure), or `genuine_bug_caught_by_test` (the test suite correctly caught a real logic error) — plus a total retry count. This is reconstructed at report-writing time by reviewing the ticket's own Step 4 history still in context, not a new live-logging mechanism. Distinct from — and complementary to — the reviewer's PASS/PASS-WITH-NOTES/FAIL verdict, which is a separate Step 5 event.
  - Add the same section (prose notes + retry log), adapted for the blocked case, to `BLOCKED_TEMPLATE.md` — a blocked run that burned its full iteration cap before giving up is at least as interesting a data point as a shipped one, and skipping it would leave a real gap in exactly the data this system exists to collect.
  - Update `EXECUTOR_ROUTINE.md` Step 7 (and Step 6, for the blocked path) to explicitly instruct writing this section, including the retry log, as part of the existing report-writing step — one line each, not a new step.
  - A short pointer note (one line) in `REPORT_TEMPLATE.md` that this section is the qualitative half of the observability system T-046 provides the quantitative half of — do not duplicate T-046's mechanics here.

Out of scope:
  - No changes to T-046's hook, schema, or JSON artifact shape.
  - No retroactive efficiency notes for already-`done`/`blocked` tickets — this only applies going forward.
  - No new template file — this amends the two existing ones in place.
  - No automated categorization of retry cause — the three categories are a fixed enum the executor picks from by judgment at report-writing time; no heuristic/detection logic to build here.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean (no code touched by this ticket; this confirms no regression)
  - `grep -q "## Efficiency notes" Docs/tickets/REPORT_TEMPLATE.md` and the same against `Docs/tickets/BLOCKED_TEMPLATE.md` both succeed
  - `grep` against both templates confirms the three retry-cause categories (`environment_setup`, `mechanical_lint_typecheck`, `genuine_bug_caught_by_test`) are named explicitly
  - `grep` against `Docs/tickets/EXECUTOR_ROUTINE.md` confirms Step 7 (and Step 6) explicitly reference the efficiency-notes section and its retry log by name

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
