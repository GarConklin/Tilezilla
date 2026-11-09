#!/usr/bin/env bash
# On the MANAGER VM: load a puzzle set from the git checkout into the farm queue.
# Reads tools/data/swap-candidates/<set>/queue.txt and <set>/specs/<id>.json, smallest boards first,
# then 0A, 0C, 0B. Jobs already solved, waiting or running are skipped, so re-running is safe.
# 6x6 boards are left out unless you pass --exclude-sizes none.
#
#   bash tools/swarm/load-queue.sh pair-swap-drafts
#   bash tools/swarm/load-queue.sh pair-swap-drafts --dry-run          # just count
#   bash tools/swarm/load-queue.sh swap-bags --sizes 3x5,3x6 --limit 100
#   bash tools/swarm/load-queue.sh swap-named --priority 20            # higher number = runs later
#
# Other folders: --queue <file> --specs <dir> (paths relative to the repo root).
source "$(dirname "${BASH_SOURCE[0]}")/farm-common.sh"

SET="${1:-}"
check_set_name "$SET"
shift
git_pull

queue="$SETS_REL/$SET/queue.txt"
specs="$SETS_REL/$SET/specs"
extra=()
while [ $# -gt 0 ]; do
  case "$1" in
    --queue) queue="$2"; shift 2 ;;
    --specs) specs="$2"; shift 2 ;;
    *) extra+=("$1"); shift ;;
  esac
done
if [ ! -f "$REPO_ROOT/$queue" ] || [ ! -d "$REPO_ROOT/$specs" ]; then
  die "$queue or $specs is not in this checkout.
       Commit + push that folder from the Windows PC first, then run this again (it does git pull)."
fi
say "Loading set '$SET' from $queue"
admin_run load --set "$SET" --queue "$queue" --specs "$specs" "${extra[@]}"
echo
echo "    Watch it:  bash tools/swarm/watch.sh"
