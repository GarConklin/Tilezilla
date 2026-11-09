#!/usr/bin/env bash
# On the MANAGER VM: save finished results off the VM through git.
#
# Writes new results of <set> into a separate checkout of branch solver-results/<set>
# (kept in ~/.tilezilla-farm/results/<set>, so the main checkout stays clean for code updates):
#   tools/data/swap-candidates/<set>/results/<id>.json      (same file the old queue runner wrote;
#                                                           over GZIP_OVER bytes -> <id>.json.gz)
#   tools/data/swap-candidates/<set>/results-progress.ndjson (one line per solved puzzle)
#   tools/data/swap-candidates/<set>/farm-results.ndjson     (full farm record per puzzle)
#   tools/data/swap-candidates/<set>/farm-status.txt/.json   (farm progress snapshot)
# then commits and pushes that branch. Safe to re-run; only new results are added.
#
#   bash tools/swarm/export-publish.sh pair-swap-drafts
#   bash tools/swarm/export-publish.sh pair-swap-drafts --every 15     # repeat every 15 minutes
#
# Needs git push access on this VM (deploy key or token - see Docs/swarm-solver.md).
source "$(dirname "${BASH_SOURCE[0]}")/farm-common.sh"

SET="${1:-}"
check_set_name "$SET"
shift
EVERY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --every) EVERY="$2"; shift 2 ;;
    *) die "unknown option $1" ;;
  esac
done
GZIP_OVER="${GZIP_OVER:-20000000}"      # bytes; bigger solves files are stored gzipped
GIT_MAX_BYTES="${GIT_MAX_BYTES:-95000000}" # GitHub rejects files over 100 MB
BRANCH="solver-results/$SET"
WT="$STATE_DIR/results/$SET"
SET_IN_WT="$WT/$SETS_REL/$SET"

ensure_worktree() {
  cd "$REPO_ROOT"
  git worktree prune
  if [ -e "$WT/.git" ]; then return; fi
  mkdir -p "$(dirname "$WT")"
  say "Preparing results branch $BRANCH"
  if git fetch -q origin "$BRANCH" 2>/dev/null; then
    git worktree add -q -B "$BRANCH" "$WT" FETCH_HEAD
    ok "using existing remote branch"
  else
    git worktree add -q --detach --no-checkout "$WT"
    (
      cd "$WT"
      git checkout -q --orphan "$BRANCH"
      git rm -rfq --cached . >/dev/null 2>&1 || true
      mkdir -p "$SETS_REL/$SET/results"
      printf 'Solver farm results for %s (written by tools/swarm/export-publish.sh on the manager VM).\nFetch on Windows with tools/swarm/fetch-results.ps1 -Set %s\n' "$SET" "$SET" > README.md
      git add README.md
      git -c user.name="TileZilla farm" -c user.email="farm@localhost" commit -qm "Start results branch for $SET"
    )
    ok "created new branch (pushed on first publish)"
  fi
  git -C "$WT" config user.name >/dev/null || git -C "$WT" config user.name "TileZilla solver farm ($(hostname))"
  git -C "$WT" config user.email >/dev/null || git -C "$WT" config user.email "farm@$(hostname)"
}

publish_once() {
  ensure_worktree
  mkdir -p "$SET_IN_WT/results"
  say "Exporting new results of '$SET' ($(date '+%F %T'))"
  admin_run export --set "$SET" --out "/state/results/$SET/$SETS_REL/$SET/results" --gzip-over "$GZIP_OVER"
  admin_run status --quiet --out "/state/results/$SET/$SETS_REL/$SET/farm-status.txt" \
    --json-out "/state/results/$SET/$SETS_REL/$SET/farm-status.json"

  # Files GitHub would refuse: keep them on the VM and list them instead.
  local big
  big="$(find "$SET_IN_WT/results" -type f -size +"$((GIT_MAX_BYTES / 1024))"k 2>/dev/null || true)"
  if [ -n "$big" ]; then
    mkdir -p "$STATE_DIR/too-big/$SET"
    while IFS= read -r f; do
      mv -f "$f" "$STATE_DIR/too-big/$SET/"
      echo "$(basename "$f") $(stat -c %s "$STATE_DIR/too-big/$SET/$(basename "$f")") bytes kept on manager VM in $STATE_DIR/too-big/$SET" >> "$SET_IN_WT/too-big.txt"
      warn "$(basename "$f") is too big for GitHub; kept in $STATE_DIR/too-big/$SET"
    done <<< "$big"
  fi

  cd "$WT"
  git add -A
  if git diff --cached --quiet; then
    ok "nothing new to commit"
  else
    local n; n="$(git diff --cached --name-only -- "$SETS_REL/$SET/results" | wc -l)"
    git commit -qm "Farm results $SET: +$n result file(s) ($(date '+%F %H:%M'))"
    ok "committed ($n new/changed result files)"
  fi
  if git push -q origin "$BRANCH" 2>&1; then
    ok "pushed to origin/$BRANCH"
  else
    warn "push failed - results are safe in $WT and will be pushed next time"
  fi
}

if [ "$EVERY" -gt 0 ] 2>/dev/null; then
  say "Publishing '$SET' every $EVERY minute(s). Ctrl+C to stop."
  while true; do
    publish_once || warn "publish run failed; will retry"
    sleep "$((EVERY * 60))"
  done
else
  publish_once
fi
