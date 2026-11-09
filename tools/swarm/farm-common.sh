#!/usr/bin/env bash
# Shared helpers for the TileZilla solver farm scripts (sourced, not run directly).
# All farm scripts run on the Swarm MANAGER VM from inside the git clone of the repo.
set -euo pipefail

FARM_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$FARM_SCRIPT_DIR/../.." && pwd)"
SWARM_DIR="$REPO_ROOT/docker/swarm"
STATE_DIR="${FARM_STATE_DIR:-$HOME/.tilezilla-farm}"
ENV_FILE="$STATE_DIR/farm.env"
PW_FILE="$STATE_DIR/redis-password"
STACK="${FARM_STACK:-farm}"
REGISTRY="127.0.0.1:5000"
IMAGE_NAME="tilezilla-solver"
SETS_REL="tools/data/swap-candidates"

mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"
# shellcheck disable=SC1090
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m    %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m    %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

need_docker() {
  command -v docker >/dev/null || die "docker is not installed on this VM"
  docker info >/dev/null 2>&1 || die "cannot talk to docker. Run:  sudo usermod -aG docker \$USER   then log out and back in"
}

is_manager() { [ "$(docker info --format '{{.Swarm.ControlAvailable}}' 2>/dev/null)" = "true" ]; }

need_manager() {
  need_docker
  is_manager || die "this VM is not the swarm manager (run tools/swarm/bootstrap.sh on the manager first)"
}

current_image() {
  local tag; tag="$(cat "$STATE_DIR/image-tag" 2>/dev/null || true)"
  [ -n "$tag" ] || die "no solver image built yet - run tools/swarm/build-and-deploy.sh"
  echo "$REGISTRY/$IMAGE_NAME:$tag"
}

git_pull() {
  [ "${NO_PULL:-0}" = "1" ] && return 0
  say "Getting the latest code and queues (git pull)"
  (cd "$REPO_ROOT" && git pull --ff-only) || warn "git pull failed - using the files already on this VM"
}

# Run the farm admin CLI (tools/swarm/farm.js) inside the solver image, attached to the farm's
# private network. The repo checkout is mounted at /repo (working dir) and the state folder at
# /state, so paths like tools/data/swap-candidates/<set>/queue.txt work as-is.
admin_run() {
  need_manager
  local img; img="$(current_image)"
  local flags=(--rm -i --user "$(id -u):$(id -g)" -v "$REPO_ROOT:/repo" -v "$STATE_DIR:/state" -w /repo)
  [ -t 0 ] && [ -t 1 ] && flags+=(-t)
  docker network inspect "${STACK}_farm" >/dev/null 2>&1 || die "farm network not found - is the stack deployed? (tools/swarm/build-and-deploy.sh)"
  docker run "${flags[@]}" --network "${STACK}_farm" \
    -e FARM_REDIS_HOST=redis -e FARM_REDIS_PORT=6379 -e FARM_REDIS_PASSWORD_FILE=/state/redis-password \
    -e FARM_CONFIG=/state/none.json -e HOME=/tmp \
    "$img" node /farm/farm.js "$@"
}

check_set_name() {
  [ -n "${1:-}" ] || die "missing set name (e.g. pair-swap-drafts)"
  [[ "$1" =~ ^[A-Za-z0-9._-]+$ ]] || die "bad set name '$1' (letters, digits, . _ - only)"
}
