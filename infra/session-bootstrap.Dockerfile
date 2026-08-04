# QuestLog remote-sandbox base image (T-125).
#
# Pre-installs postgresql-16-pgvector via the PGDG channel so
# .claude/hooks/session-start.sh's remote-sandbox branch
# (session-start.sh:129, `dpkg -s postgresql-16-pgvector`) finds the package
# already present and skips its own apt-get install block for free — no
# change to session-start.sh's own logic is required to benefit from this
# image. See infra/README.md for the build/publish/wire-up steps and
# Docs/IMPLEMENTATION_NOTES.md § T-125 for why this exists.
#
# Base OS matches the sandbox's own confirmed OS (Ubuntu 24.04 "noble" —
# verified in Docs/IMPLEMENTATION_NOTES.md § T-098's real-container testing).
# If the actual Claude Code Remote base image ever changes OS, this file's
# FROM line and PGDG codename need to move with it.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Package list and install sequence mirror session-start.sh:129-152's own
# PGDG-first path verbatim (same key URL, same signed-by keyring, same
# codename substitution) — T-098 already proved this exact sequence installs
# pgvector 0.8.5-1.pgdg24.04+1 live in a genuine Ubuntu 24.04 container, so
# reusing it here rather than a rewritten equivalent keeps that proof valid.
RUN apt-get update -qq \
	&& apt-get install -y -qq --no-install-recommends \
		ca-certificates \
		gnupg \
		wget \
		lsb-release \
		sudo \
		postgresql-common \
	&& wget -qO /tmp/pgdg.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
	&& gpg --dearmor -o /usr/share/keyrings/pgdg.gpg /tmp/pgdg.asc \
	&& echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
		> /etc/apt/sources.list.d/pgdg.list \
	&& apt-get update -qq \
	&& apt-get install -y -qq postgresql-16-pgvector \
	&& rm -f /tmp/pgdg.asc /etc/apt/sources.list.d/pgdg.list \
	&& rm -rf /var/lib/apt/lists/*

# session-start.sh's own `dpkg -s postgresql-16-pgvector` check (line 129)
# is satisfied by this point — nothing further is required for that block to
# skip. The pgdg.list source is removed afterward (matching
# session-start.sh:146's own cleanup of its equivalent temporary source) so
# no stray apt source survives into the running sandbox.
