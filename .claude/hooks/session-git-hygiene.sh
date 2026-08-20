#!/bin/bash
# SessionStart hook — git/session hygiene only. Runs for every session,
# local and remote. Split out from session-start.sh (which also handled
# local and remote Postgres provisioning — three unrelated jobs bolted into
# one file that ran on every session start, regardless of what any of them
# actually needed) into session-db-local.sh/session-db-remote.sh, registered
# as separate SessionStart hook entries in .claude/settings.json. Multiple
# hook entries for the same event run in parallel and are fully independent
# processes — nothing here is shared with the other two scripts' shell
# state, so each is self-contained.
set -euo pipefail

# Runner-neutral default — see Docs/IMPLEMENTATION_NOTES.md § T-138.
: "${CLAUDE_PROJECT_DIR:=$(git rev-parse --show-toplevel)}"

cd "$CLAUDE_PROJECT_DIR"

# --- shared-primary-directory warning: begin ---
# The hook itself can't relocate this session (each Bash call's cwd is
# fixed by the harness for the session's lifetime) — this is a mechanical
# nudge reinforcing AGENTS.md's "Session isolation" rule, not the
# enforcement mechanism itself. Only fires locally: a remote sandbox is
# already a fresh, disposable checkout with nothing else sharing it. Why:
# Docs/IMPLEMENTATION_NOTES.md § T-147 (two interactive sessions collided
# in the shared primary checkout the same day this was added).
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  case "$CLAUDE_PROJECT_DIR" in
    */tmp/worktrees/* | */.claude/worktrees/*) ;;
    *)
      echo "⚠️  session-git-hygiene.sh: this session is in the SHARED PRIMARY checkout, not an isolated worktree."
      echo "⚠️  Per AGENTS.md 'Session isolation': before editing anything, run —"
      echo "⚠️    git fetch origin develop && git worktree add tmp/worktrees/<short-slug> -B <branch-name> origin/develop"
      echo "⚠️    cd tmp/worktrees/<short-slug>"
      echo "⚠️  — then do all work there. Skip only if this session makes no edits."
      ;;
  esac
fi
# --- shared-primary-directory warning: end ---

pnpm install

# --- develop-sync guard: begin (extracted verbatim by the T-041 repro
#     harness — keep this block self-contained and don't rename the
#     markers without updating the repro script that greps for them) ---
# Refreshes .claude/commands/.claude/skills files from origin/develop that
# this branch hasn't itself touched (merge-base diff, so a committed-but-
# unmerged edit is never clobbered). Ungated from remote-only in the T-070
# follow-up below. Why: Docs/IMPLEMENTATION_NOTES.md § T-041.
git fetch origin develop --quiet 2>/dev/null || true
merge_base="$(git merge-base HEAD origin/develop 2>/dev/null || true)"
if [ -n "$merge_base" ]; then
  synced_count=0
  while IFS= read -r -d '' file; do
    if git diff --quiet "$merge_base" -- "$file" 2>/dev/null; then
      if git checkout origin/develop -- "$file" 2>/dev/null; then
        echo "session-git-hygiene.sh: refreshed $file from origin/develop (untouched by this branch)"
        synced_count=$((synced_count + 1))
      fi
    fi
  done < <(git ls-tree -r -z --name-only "$merge_base" -- .claude/commands .claude/skills 2>/dev/null)
  if [ "$synced_count" -gt 0 ]; then
    echo "session-git-hygiene.sh: synced $synced_count file(s) from origin/develop — this branch's own edits (if any) were left untouched"
  fi
fi
# --- develop-sync guard: end ---

# --- develop-ff guard: begin ---
# Fast-forwards local develop only when safe (exactly on develop, clean tree)
# so a direct-to-develop push (/promote, /promote-execute) doesn't get
# rejected non-fast-forward. Why, not just what: Docs/IMPLEMENTATION_NOTES.md
# § T-041 "Second follow-up".
current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [ "$current_branch" = "develop" ] && git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
  before_sha="$(git rev-parse HEAD 2>/dev/null || true)"
  if git merge --ff-only origin/develop --quiet 2>/dev/null; then
    after_sha="$(git rev-parse HEAD 2>/dev/null || true)"
    if [ -n "$after_sha" ] && [ "$before_sha" != "$after_sha" ]; then
      echo "session-git-hygiene.sh: fast-forwarded local develop $before_sha -> $after_sha"
    fi
  fi
fi
# --- develop-ff guard: end ---
