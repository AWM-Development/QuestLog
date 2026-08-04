# `infra/` — remote-sandbox base image (T-125)

Repo-side half of `M-EFFICIENCY.13` / `T-125` (cutting `.claude/hooks/session-start.sh`'s
remote-sandbox bootstrap wall-clock). This directory only holds the Dockerfile
and this write-up — nothing here is consumed by the app itself.

## What this image is for

`session-start.sh`'s remote branch (`CLAUDE_CODE_REMOTE=true`) installs
`postgresql-16-pgvector` via apt on every fresh session (session-start.sh:129-152)
because Ubuntu's own pinned package (0.6.0) is three minors behind the 0.8.x
`hnsw.iterative_scan` needs (`Docs/IMPLEMENTATION_NOTES.md` § T-016, § T-098).
That install is the dominant fixed cost of session bootstrap on a cold
sandbox. `session-start.sh:129`'s own `dpkg -s postgresql-16-pgvector` check
already skips the whole block for free if the package is already present —
this image exists purely to make that true before the hook ever runs, by
baking the identical PGDG install sequence into the base image instead of
running it live every session.

**No change to `session-start.sh`'s own logic is required for this to take
effect.** Once the Claude Code Remote environment is pointed at this image
(see "Wiring it in," below — explicitly not something this ticket did), the
existing `dpkg -s` check passes on line 1 and the entire apt-get/PGDG block
(session-start.sh:129-152) never executes.

## Building it

```bash
docker build -f infra/session-bootstrap.Dockerfile -t questlog-session-bootstrap:latest .
```

Verified locally (2026-08-04, Docker 27.4.0, arm64 host) — full build log and
the two checks below are pasted in this ticket's report
(`Docs/tickets/reports/T-125-session-bootstrap-speed.md`):

```
$ docker run --rm questlog-session-bootstrap:latest dpkg -s postgresql-16-pgvector
Package: postgresql-16-pgvector
Status: install ok installed
Version: 0.8.6-1.pgdg24.04+1
...
```

i.e. the PGDG path genuinely resolves to a newer pgvector (0.8.6) than the
0.8.5 T-098 observed — PGDG ships whatever's current, so the exact patch
version will drift over time; what matters is it's always the PGDG 0.8.x
line, never Ubuntu's pinned 0.6.0. Also confirmed the temporary
`/etc/apt/sources.list.d/pgdg.list` source added mid-build does not survive
into the final image (removed in the same `RUN`, matching
`session-start.sh:146`'s own cleanup of its equivalent temporary source).

## Wiring it in (Alex-only — not attempted by this ticket)

Actually pointing the Claude Code Remote environment's base-image setting at
this image is an environment-configuration change outside this repo's
control (same category as the real-credential/Alex-only steps in
`Docs/DEPLOY_READINESS.md`/`Docs/DEPLOY_SETUP_CHECKLIST.md`). This ticket
does not attempt it and does not claim it happened. To do it:

1. Push the built image somewhere the CCR environment can pull it from —
   there's no existing container registry convention in this repo (deploy
   is Fly.io, source-based, no registry push today), so the natural choice
   is GitHub Container Registry tied to this repo:
   ```bash
   docker tag questlog-session-bootstrap:latest ghcr.io/awm-development/questlog-session-bootstrap:latest
   docker push ghcr.io/awm-development/questlog-session-bootstrap:latest
   ```
   (Requires a `docker login ghcr.io` with a PAT that has `write:packages` —
   an Alex-only credential step, not something to script here.)
2. In the Claude Code Remote environment's own settings (outside this repo),
   set the sandbox base image to `ghcr.io/awm-development/questlog-session-bootstrap:latest`.
3. Confirm on the next remote executor run: `session-start.sh`'s remote
   branch should skip straight past the `dpkg -s` check (session-start.sh:129)
   with no apt-get/PGDG output at all, and the "remote sandbox DB provisioned
   OK" line should print measurably sooner than before.

Until step 2 happens, this image has no effect on anything — the hook's own
live PGDG-install fallback keeps working exactly as before, unaffected by
this image's existence.

## pnpm warm-cache behavior — verified, not assumed

Ticket item 2 asked to confirm *why* `pnpm install` (session-start.sh:7,
runs before either branch) already completes in well under a second on a
provisioned session, and whether that depends on a warm pnpm store/`node_modules`
carried forward rather than a cold install.

**Confirmed: yes, it depends on a warm store, and this is not incidental.**
This ticket's own session (2026-08-04) observed `session-start.sh`'s `pnpm
install` line complete in 928ms with output `Lockfile is up to date,
resolution step is skipped` / `Already up to date` — not a cold install log
(no per-package fetch/resolve lines). Reasoning from pnpm's own mechanics
(`packageManager: pnpm@9.15.5` in `package.json`) confirms why that output
shape implies a warm store:

- pnpm never copies packages into `node_modules` from the registry directly.
  It fetches into a single content-addressable global store once
  (`pnpm config get store-dir` — platform-dependent, e.g.
  `~/Library/pnpm/store` on macOS, `~/.local/share/pnpm/store` on Linux) and
  hard-links from there into every project's `node_modules`. A second
  install against an unchanged lockfile, with the store already populated
  and `node_modules` already present and consistent with it, is nearly free —
  no network fetch, no new links to create — which is exactly the "lockfile
  up to date, resolution skipped" shortcut that fired here.
- If either `node_modules` or the store were genuinely cold (first install
  on a truly fresh filesystem, no prior session's artifacts), pnpm would
  print real resolve/fetch/link timing for every package instead of
  short-circuiting, and would take meaningfully longer than under a second.

**So this fast path is not something the current setup gets "for free" from
pnpm in general — it's a direct consequence of the sandbox/session already
carrying a warm store and/or `node_modules` forward from prior provisioning.**
This matters for this image specifically: **if a future revision of this
Dockerfile (or the CCR base image, once wired in per above) ever changes
what's baked in without also carrying pnpm's store forward, the
short-circuit above silently stops applying and `pnpm install` reverts to a
full cold install** — same class of regression this ticket's primary fix
targets, just for `pnpm install` instead of `postgresql-16-pgvector`. This
Dockerfile deliberately does **not** attempt to bake in a pnpm store or
`node_modules` itself (out of scope — installing `pnpm`/Node into this image
at all was never part of this ticket's scope, since the base image's job is
Postgres provisioning, not the JS toolchain); the warm-store behavior
observed today comes from whatever the *existing* CCR provisioning already
does, not from anything in this directory. Whoever next touches CCR's base
image or provisioning pipeline should re-verify this regression note is
still true rather than assuming it.
