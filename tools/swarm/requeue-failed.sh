#!/usr/bin/env bash
# On the MANAGER VM: list failed jobs, then put them back in the queue with a fresh attempt counter.
#
#   bash tools/swarm/requeue-failed.sh                    # all sets
#   bash tools/swarm/requeue-failed.sh pair-swap-drafts   # one set
#   bash tools/swarm/requeue-failed.sh --list             # only show what failed and why
source "$(dirname "${BASH_SOURCE[0]}")/farm-common.sh"

if [ "${1:-}" = "--list" ]; then
  admin_run failed --verbose
  exit 0
fi
setargs=()
if [ -n "${1:-}" ]; then check_set_name "$1"; setargs=(--set "$1"); fi
say "Failed jobs"
admin_run failed "${setargs[@]}"
say "Requeueing"
admin_run requeue-failed "${setargs[@]}"
