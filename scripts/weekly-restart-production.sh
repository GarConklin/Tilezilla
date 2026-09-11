#!/usr/bin/env bash
# Soft weekly refresh of Tilezilla production app containers.
# Restarts web / gateway / php-auth to clear leaked threads and stale workers.
# Does NOT restart MySQL (avoids unnecessary DB bounce).
#
# Usage:
#   ./scripts/weekly-restart-production.sh
#   ./scripts/weekly-restart-production.sh --with-mysql   # rare; full stack bounce
#
# Install timer (Wednesday 03:00 local):
#   sudo ./scripts/install-production-weekly-restart.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE="$REPO_ROOT/.env.production"
WITH_MYSQL=0
LOG_DIR="${TILEZILLA_RESTART_LOG_DIR:-$REPO_ROOT/data}"
LOG_FILE="$LOG_DIR/weekly-restart.log"

for arg in "$@"; do
  case "$arg" in
    --with-mysql) WITH_MYSQL=1 ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
  esac
done

cd "$REPO_ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

{
  echo ""
  echo "==== $(ts) weekly restart begin ===="
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps || true
  docker stats --no-stream || true

  if [[ "$WITH_MYSQL" -eq 1 ]]; then
    echo "$(ts) restarting gateway web php-auth mysql"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart gateway web php-auth mysql
  else
    echo "$(ts) restarting gateway web php-auth (mysql left running)"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart gateway web php-auth
  fi

  sleep 5
  if [[ -x "$REPO_ROOT/scripts/health-check-production.sh" ]]; then
    "$REPO_ROOT/scripts/health-check-production.sh" --ensure-up || true
  fi

  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps || true
  docker stats --no-stream || true
  echo "==== $(ts) weekly restart done ===="
} | tee -a "$LOG_FILE"
