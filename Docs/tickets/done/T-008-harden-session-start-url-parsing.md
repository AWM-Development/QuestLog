# T-008 — Replace session-start.sh's hand-written DATABASE_URL regex with a real URL parser

Milestone ref: M-MCP.3 (`Docs/MILESTONES_V1_MCP.md`) — hardening follow-up
from T-002's post-merge code review; not itself a milestone task
(`.claude/hooks/session-start.sh` is pipeline tooling, not product code)

Branch: feat/m-mcp/t-008-harden-session-start-url-parsing

Context files (load ONLY these):
  - .claude/hooks/session-start.sh
  - .env.example

Mockup: none

Model: sonnet

Scope:
  `.claude/hooks/session-start.sh` parses `DATABASE_URL` (read from `.env`,
  falling back to `.env.example`) with a hand-written bash regex
  (`^postgresql://([^:]+):([^@]+)@[^:/]+:([0-9]+)/`) to extract
  `DB_USER`/`DB_PASSWORD`/`PGPORT`. This regex fails on inputs a real URL
  parser handles correctly: a URL with no explicit port (the regex requires
  `:PORT` present), and an unescaped delimiter character (e.g. `@`) inside
  the password (the regex splits on the first `@`, not the last one before
  the host). Replace the regex with a real URL parser — e.g. a one-line
  `node -e "const u = new URL(process.env.DATABASE_URL); ..."` invocation
  (Node is already a hard dependency of this hook, which runs `pnpm install`
  first) that emits `DB_USER`/`DB_PASSWORD`/`PGPORT` in a form the rest of
  the script can consume. Preserve this hook's existing successful behavior
  against this repo's actual `.env`/`.env.example` exactly, and preserve the
  existing friendly failure message
  (`session-start.sh: couldn't parse DATABASE_URL from $ENV_FILE`) for a
  genuinely unparseable URL.

Out of scope:
  - No change to what `DATABASE_URL` points at, or to the rest of the
    hook's provisioning logic (role/database creation, migration
    invocation).
  - No general-purpose `.env` parsing library — this is a targeted fix for
    the one URL this hook needs to read.

Exit condition (machine-checkable):
  - the hook still succeeds end-to-end against this repo's actual `.env`/
    `.env.example` (paste the actual run output, not a description)
  - a standalone demonstration (small script, run and its output pasted —
    not just described) shows the new parser correctly handles a
    DATABASE_URL with no explicit port, where the old regex would have
    failed to match
  - a standalone demonstration shows the new parser correctly extracts a
    password containing an unescaped `@`, where the old regex silently
    truncated it at the wrong character

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_MCP.md is NOT
  applicable (not a milestone task), IMPLEMENTATION_NOTES.md updated if any
  non-obvious decision was made, a CHANGELOG.md entry under [Unreleased],
  morning report written.
