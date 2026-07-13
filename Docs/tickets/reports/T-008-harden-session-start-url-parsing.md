# T-008 — Replace session-start.sh's hand-written DATABASE_URL regex with a real URL parser

**Outcome:** shipped
**Branch:** feat/m-mcp/t-008-harden-session-start-url-parsing
**Diff:** 3 files changed, +23/-5 lines (`.claude/hooks/session-start.sh`, `CHANGELOG.md`, `Docs/IMPLEMENTATION_NOTES.md`)

## What shipped

`.claude/hooks/session-start.sh` now parses `DATABASE_URL` with Node's `URL` class (via a `node -e` one-liner) instead of a hand-written bash regex. The old regex required an explicit `:PORT` and split on the first `@`, so a portless `DATABASE_URL` failed to parse and any password containing an unescaped `@` was silently truncated. The new parser defaults to port `5432` when none is given and correctly extracts passwords containing `@`, while preserving the existing friendly failure message for genuinely unparseable input.

## Test evidence

Hook run end-to-end against this repo's actual `.env.example` (no `.env` present):

```
$ CLAUDE_PROJECT_DIR=/home/user/QuestLog bash /home/user/QuestLog/.claude/hooks/session-start.sh
...
CREATE ROLE
CREATE DATABASE
> @questlog/server@0.0.0 db:migrate
Enabling extensions...
Running migrations...
Migrations complete.
CREATE DATABASE
> @questlog/server@0.0.0 db:migrate
Enabling extensions...
Running migrations...
Migrations complete.
```

Standalone demo against the exact parsing block now in `session-start.sh`:

```
-- repo's actual .env.example value --
DB_USER=questlog DB_PASSWORD=questlog PGPORT=5433
-- no explicit port (old regex failed here) --
DB_USER=questlog DB_PASSWORD=questlog PGPORT=5432
-- unescaped @ in password (old regex truncated to 'pass') --
DB_USER=questlog DB_PASSWORD=pass@word PGPORT=5433
-- genuinely unparseable input --
session-start.sh: couldn't parse DATABASE_URL from demo
```

Old regex, for comparison (reproducing the two bugs being fixed):

```
=== Case 1: no explicit port ===
input: postgresql://questlog:questlog@localhost/questlog
FAILED TO PARSE

=== Case 2: unescaped @ in password ===
input: postgresql://questlog:pass@word@localhost:5433/questlog (real password is 'pass@word')
DB_USER=questlog
DB_PASSWORD=pass
PGPORT=5433
```

Lint / typecheck / test:

```
$ pnpm lint
 Tasks:    4 successful, 4 total
Cached:    0 cached, 4 total
  Time:    855ms

$ pnpm typecheck
 Tasks:    4 successful, 4 total
Cached:    0 cached, 4 total
  Time:    16.734s

$ pnpm test
@questlog/server:test:  Test Files  29 passed (29)
@questlog/server:test:       Tests  229 passed (229)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
 Tasks:    3 successful, 3 total
Cached:    0 cached, 3 total
  Time:    26.77s
```

## Exit condition check

- **Hook succeeds end-to-end against actual `.env`/`.env.example`** — verified above; no `.env` exists in this repo so it read `.env.example` (`postgresql://questlog:questlog@localhost:5433/questlog`), provisioned Postgres 16 + pgvector, created the role/databases, and ran migrations clean on both `questlog` and `questlog_test`.
- **Standalone demo: no explicit port** — verified above (`postgresql://questlog:questlog@localhost/questlog` → `PGPORT=5432`), where the old regex failed to match entirely.
- **Standalone demo: unescaped `@` in password** — verified above (`postgresql://questlog:pass@word@localhost:5433/questlog` → `DB_PASSWORD=pass@word`), where the old regex truncated to `pass`.

## Reviewer verdict

**PASS.** Reviewer's notes verbatim:

> I independently reproduced the parser's behavior with Node (matching the exact `new URL()` + `decodeURIComponent` logic in `.claude/hooks/session-start.sh:29-42`):
> - Regression (repo's actual `.env.example` value): correct, matches pre-existing behavior.
> - Portless URL: `u.port` is `""`, and `const port = u.port || "5432"` (`session-start.sh:36`) correctly defaults to 5432.
> - Unescaped `@` in password: WHATWG `URL` auto-encodes it to `p%40ss` in `u.password`, and `decodeURIComponent` correctly recovers `p@ss` — exactly the case the old regex got wrong.
> - Genuine failure (`not-a-url`): throws, caught, `process.exit(1)`, and bash preserves the original friendly message at `session-start.sh:44`.
> - Empty-username edge case: caught by the explicit `!u.username` check (`session-start.sh:32`), correctly rejected.
>
> Design/security notes (no issues found): raw value passed via env var rather than string-interpolated into JS source (avoids injection through quote/backtick characters); output handed back via newline-delimited fields consumed with `read -r`, not `eval` (avoids shell-metacharacter injection from the password).
>
> Scope check: no change to `DATABASE_URL`'s value or the rest of the hook's provisioning logic; no general `.env` parsing library added; `CHANGELOG.md`/`IMPLEMENTATION_NOTES.md` entries accurate, no scope creep.
>
> Minor observation (not blocking): the new parser also accepts a `postgres:` protocol alias in addition to `postgresql:`, slightly broadening what the old regex accepted — strictly more permissive, no functional regression, just worth a human glance.
>
> No functionality gaps against the exit conditions, no test theater, no scope creep. **PASS**

## Anything Alex must decide

- The reviewer flagged one minor, non-blocking observation: the new parser accepts both `postgresql:` and `postgres:` URL schemes, whereas the old regex only matched `postgresql://` literally. This is strictly more permissive and doesn't change behavior for any URL this repo actually uses, but it's a small addition beyond the ticket's literal wording — flagging in case you'd rather it stay strict to `postgresql:` only.
- No 🧠 strategy gates in this ticket; not a milestone task, so no `MILESTONES_V1_MCP.md` checkbox applies.
