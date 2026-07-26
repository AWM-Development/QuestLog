---
description: Brief list of every pipeline command with a one-line summary
---

Read `Docs/tickets/COMMANDS.md` and print its command table as a compact, readable list — command name, args, one-line summary. This is the fast path; don't open every individual `.claude/commands/*.md` file to answer this.

## Drift check (do this every time, it's cheap)

`Docs/tickets/COMMANDS.md` is a hand-maintained summary, not a generated one — it can go stale. Before presenting the list:
1. `ls .claude/commands/*.md` and diff that filename list against `COMMANDS.md`'s table rows.
2. If any command file has no row, or a row references a command file that no longer exists, say so explicitly at the top of your response (e.g. `⚠️ Docs/tickets/COMMANDS.md is missing an entry for /foo — update it`) before showing the rest of the list. Do not silently patch `COMMANDS.md` yourself — flag it, same as any other doc drift, and let Alex decide whether to fix it now or later.

End the response with a one-line pointer: "Full behavior for any of these lives in `.claude/commands/<name>.md`, or the summary spec at `Docs/tickets/COMMANDS.md`."
