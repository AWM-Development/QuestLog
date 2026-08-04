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
