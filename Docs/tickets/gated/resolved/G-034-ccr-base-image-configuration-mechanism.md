# G-034 — CCR base-image configuration mechanism

Gate type: 🧠 strategy

Milestone ref: Docs/milestones/MILESTONES_V1_2_MCP.md M-EFFICIENCY.13

Opened: 2026-08-04 — filed during `/morning-review` of T-125's PR (#191), by agent, at Alex's explicit request

Context files (load ONLY these):
  - infra/README.md ("Wiring it in" section — the three steps this gate questions)
  - infra/session-bootstrap.Dockerfile (the artifact whose deployment path is in question)
  - .claude/hooks/session-start.sh:129-152 (the `dpkg -s postgresql-16-pgvector` check this whole approach is meant to short-circuit)
  - Docs/tickets/done/T-125-session-bootstrap-speed.md (the ticket's own mixed-autonomy banner, which already flagged "wiring it in" as Alex-only but asserted — without verifying — that a pointable base-image setting exists)

Open question: Does "Claude Code Remote" (the `CLAUDE_CODE_REMOTE=true` environment `session-start.sh` targets) actually expose a way to run sessions from a custom Docker image at all — and if so, which mechanism, since research below found the answer depends entirely on which Claude Code product surface this is:

  - If it's Anthropic's standard Managed Agents `type: cloud` environment: there is **no custom-base-image field**. The only documented customization is a `packages` field (`packages.apt`, `.pip`, `.npm`, `.cargo`, `.gem`, `.go`) that pre-installs named packages via their package manager before the agent starts — e.g. `packages.apt: ["postgresql-16-pgvector"]`. This does *not* document a way to add an apt repository (PGDG) first, so it's unclear whether it would resolve to Ubuntu's pinned 0.6.0 (the exact version problem T-098/T-125 exist to avoid) or somehow pull 0.8.x. `infra/session-bootstrap.Dockerfile`'s whole approach (a custom image) would be the wrong lever entirely in this case — the fix would be a `packages` config change (if PGDG can be reached some other way) or nothing this repo controls.
  - If it's "Claude Code on the web" (Anthropic-managed VM, network-proxied): no environment customization surface is documented for it at all in the docs found.
  - If it's a **self-hosted sandbox** (Cloudflare/Daytona/Modal/Vercel provider, or a custom sandbox client) run by AWM/Alex's own infrastructure: custom Docker images ARE supported there — e.g. Cloudflare's self-hosted setup builds its sandbox image from a Dockerfile extending a provider base image. If this is the actual setup, `infra/session-bootstrap.Dockerfile` is the right kind of artifact, and "wiring it in" means updating that provider's sandbox image config/build, not a Claude Code product setting.

  The exact question for Alex: which of these three is actually true for the sessions `session-start.sh` runs `CLAUDE_CODE_REMOTE=true` in? Once known, the resolution is either (a) confirm the `infra/session-bootstrap.Dockerfile` approach is correct and document the real wiring steps for whichever self-hosted provider is in use, or (b) if it's a standard Anthropic `type: cloud` environment, determine whether `packages.apt` can reach PGDG at all, and if not, close this out as "not currently achievable" rather than leaving a Dockerfile nobody can ever wire in.

Blocks: none yet (T-125 already shipped and merged with the Dockerfile/README as documented-but-unwired; no ticket is currently waiting on this resolution)

Notes: Surfaced when Alex reviewed T-125's PR via `/morning-review` and pushed back on the "Wiring it in" steps in `infra/README.md` — specifically step 3 ("point Claude Code Remote's settings at this image"), which Alex said he has no idea how to do. Investigation for this gate (web research, since nothing in this repo documents which CCR surface AWM actually runs on) found:
  - Anthropic's public "Managed Agents" API docs (`platform.claude.com/docs/en/managed-agents/environments`) describe `type: cloud` environments with a `packages` field (apt/pip/npm/cargo/gem/go) — no custom-base-image field documented.
  - Anthropic's Claude Code docs (`code.claude.com/docs/en/sandbox-environments`) describe dev containers, custom containers, and VMs as *local/self-managed* isolation options — separate from the "cloud" managed-agents environment above — and confirms full custom Docker images are a supported pattern there, just not through the same `environments` API.
  - Self-hosted sandbox docs (`platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes`, and third-party provider guides for Cloudflare/Modal/Daytona/Vercel) confirm custom Docker images are the norm for that path — "the image is built from the repo's Dockerfile, which extends the [provider] Sandbox base image."
  - None of this confirms which of these AWM's own `CLAUDE_CODE_REMOTE=true` sessions actually run under — that's internal to however Alex/AWM provisions these sessions, not documented anywhere in this repo, and not something a repo-scoped session can discover on its own.

  This means T-125's own "Wiring it in" instructions in `infra/README.md` were written on an unverified assumption (that *some* pointable base-image setting exists) inherited from the ticket's own mixed-autonomy banner, which itself asserted it as fact rather than flagging it as unknown. That's the actual gap: this should have been raised as a gate at ticket-writing time, not stated as three confident steps in the shipped report.

## Resolution (2026-08-04)

Resolved interactively with Alex, using the actual "Edit routine" / "New cloud environment" UI (screenshots) rather than public docs alone, plus two live diagnostic routine runs against a throwaway test environment.

**The environment surface is confirmed**: it's a Claude-native scheduled routine pointed at a named "cloud environment." That environment's config UI exposes exactly four things — Name, Network access, Environment variables, and a Setup script (bash run before Claude Code launches). **No custom-base-image field exists.** This settles the original open question directly: `infra/session-bootstrap.Dockerfile` had no mechanism to plug into on this platform. It has been removed.

**Setup script does not persist state across sessions either.** Tested empirically: the identical PGDG-install commands were run as a Setup script in two separate, back-to-back sessions against the same test environment. Both logged a full fresh install (`RESULT: not installed, running PGDG install now`), not a cached hit. Every session is a genuinely cold sandbox — there is no "pre-bake once" lever anywhere on this platform today, whether via a custom image or a persisted setup step.

**Unplanned but more important finding**: both test runs installed `postgresql-16-pgvector 0.6.0-1` — Ubuntu's own pinned package, not PGDG's 0.8.x. Root-caused via direct reachability testing from inside the live sandbox: the egress proxy (`127.0.0.1:40201`) hard-403s the CONNECT tunnel to `apt.postgresql.org`, `www.postgresql.org`, `ppa.launchpadcontent.net`, and `deb.nodesource.com` alike — a policy block, not a DNS or apt-config issue. This means `session-start.sh`'s existing "try PGDG first" logic had never actually been reaching PGDG in this sandbox class; it was silently falling back to Ubuntu's 0.6.0 every session, three minors behind what `hnsw.iterative_scan` needs (§ T-016) — a live correctness gap independent of anything T-125 originally set out to fix.

**GitHub was confirmed reachable** (`github.com`, `raw.githubusercontent.com` both return real HTTP responses through the same proxy, unlike the blocked hosts above), and `build-essential`/`postgresql-server-dev-16` are both installable from the already-reachable `archive.ubuntu.com`. This makes a from-source pgvector build viable where apt-based approaches are not.

**Decision**: drop the custom-base-image approach entirely (no achievable mechanism on this platform); fix `session-start.sh` to build pgvector from source, pinned to `0.8.5` (matching `docker-compose.yml`/`ci.yml`'s `pgvector/pgvector:0.8.5-pg16`, restoring parity across all four QuestLog Postgres environments). Implemented directly on the T-125 branch rather than as a separate ticket, verified via a real from-scratch Docker rebuild (caught and fixed a genuine segfault along the way — pgvector's default `-march=native` build flag crashes Postgres on `CREATE EXTENSION`; fixed with `OPTFLAGS=""`, pgvector's own documented mitigation). Full evidence and the corrected implementation are in `Docs/tickets/reports/T-125-session-bootstrap-speed.md`'s "Correction" section and `Docs/IMPLEMENTATION_NOTES.md` § T-125.

No tickets were drafted from this resolution — the fix landed directly on T-125's own branch per Alex's explicit instruction, rather than being deferred to a new ticket. `Blocks:` was `none yet`, so nothing else needed to be swept or cleared.
