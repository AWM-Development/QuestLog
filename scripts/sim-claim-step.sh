#!/usr/bin/env bash
# T-073: demonstrates the T-###/G-### id-collision bug (unfixed look-then-act
# numbering) and confirms the claim-then-draft fix (GATE_SPEC.md "Claiming a
# number", ticket-writer step 6) resolves two concurrent sessions to distinct
# numbers instead. Uses plain files as a stand-in for committed-and-pushed
# tickets; the real fix's mutex is the push itself (see GATE_SPEC.md), not
# git mechanics this script doesn't need to model to prove the ordering claim.
set -euo pipefail

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
mkdir -p "$WORKDIR/unfixed" "$WORKDIR/fixed"

for d in unfixed fixed; do
  for i in 001 002 003 004 005; do
    touch "$WORKDIR/$d/T-$i-existing.md"
  done
done

next_number() {
  local dir="$1" max=0 n
  for f in "$dir"/T-*.md; do
    n=$(basename "$f" | sed -E 's/^T-([0-9]+).*/\1/')
    n=$((10#$n))
    [ "$n" -gt "$max" ] && max=$n
  done
  printf "%03d" $((max + 1))
}

echo "=== UNFIXED: look-then-act, no claim step ==="
echo "Both sessions scan BEFORE either writes (the race window that caused G-012/G-013):"
N_A=$(next_number "$WORKDIR/unfixed")
N_B=$(next_number "$WORKDIR/unfixed")
echo "Session A scans -> next free = T-$N_A"
echo "Session B scans -> next free = T-$N_B"
touch "$WORKDIR/unfixed/T-$N_A-session-a-ticket.md"
touch "$WORKDIR/unfixed/T-$N_B-session-b-ticket.md"
if [ "$N_A" = "$N_B" ]; then
  echo "COLLISION: both sessions picked T-$N_A"
else
  echo "UNEXPECTED: no collision in unfixed simulation (should not happen)"
  exit 1
fi

echo
echo "=== FIXED: claim-then-draft (commit-and-push placeholder before drafting) ==="
N_A=$(next_number "$WORKDIR/fixed")
echo "Session A scans -> next free = T-$N_A -> claims immediately (placeholder commit+push):"
echo "# T-$N_A — <working title>" > "$WORKDIR/fixed/T-$N_A-session-a-ticket.md"
N_B=$(next_number "$WORKDIR/fixed")
echo "Session B scans AFTER A's claim is visible -> next free = T-$N_B -> claims immediately:"
echo "# T-$N_B — <working title>" > "$WORKDIR/fixed/T-$N_B-session-b-ticket.md"
if [ "$N_A" != "$N_B" ]; then
  echo "NO COLLISION: A got T-$N_A, B got T-$N_B — distinct numbers"
else
  echo "FAIL: fixed simulation still collided"
  exit 1
fi
