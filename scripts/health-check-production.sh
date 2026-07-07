#!/usr/bin/env bash
# Verify (and optionally start) the Tilezilla production Docker stack.
#
# Usage:
#   ./scripts/health-check-production.sh              # check only
#   ./scripts/health-check-production.sh --ensure-up  # start stack if down, then check
#
# Install for boot (on the VPS, once):
#   sudo ./scripts/install-production-health-check.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE="$REPO_ROOT/.env.production"
ENSURE_UP=0
CHECK_NGINX=1

for arg in "$@"; do
  case "$arg" in
    --ensure-up) ENSURE_UP=1 ;;
    --no-nginx) CHECK_NGINX=0 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

failures=0
note() { printf '%s\n' "$*"; }
ok() { note "  OK  $*"; }
warn() { note "  WARN  $*"; failures=$((failures + 1)); }
bad() { note "  FAIL  $*"; failures=$((failures + 1)); }

note "==> Tilezilla production health check"
note "    repo: $REPO_ROOT"

if ! command -v docker >/dev/null 2>&1; then
  bad "docker not installed"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  bad "docker daemon not running (try: sudo systemctl start docker)"
  exit 1
fi
ok "docker daemon"

if [[ ! -f "$ENV_FILE" ]]; then
  bad "missing $ENV_FILE"
  exit 1
fi
ok "env file"

if ! docker volume inspect tilezilla_shared_mysql_data >/dev/null 2>&1; then
  warn "volume tilezilla_shared_mysql_data missing (first deploy?)"
fi

expected_services=(mysql web php-auth gateway)
running=0

for svc in "${expected_services[@]}"; do
  state="$(compose ps --status running --services 2>/dev/null | grep -Fx "$svc" || true)"
  if [[ -n "$state" ]]; then
    running=$((running + 1))
    ok "container $svc running"
  else
    bad "container $svc not running"
  fi
done

if (( ENSURE_UP == 1 )) && (( running < ${#expected_services[@]} )); then
  note "==> Starting production stack (--ensure-up)"
  compose up -d
  sleep 3
  running=0
  for svc in "${expected_services[@]}"; do
    state="$(compose ps --status running --services 2>/dev/null | grep -Fx "$svc" || true)"
    if [[ -n "$state" ]]; then
      running=$((running + 1))
      ok "container $svc running (after up)"
    else
      bad "container $svc still not running"
    fi
  done
fi

note "==> MySQL health"
mysql_health="$(docker inspect garz-puzzle-mysql --format '{{.State.Health.Status}}' 2>/dev/null || echo missing)"
if [[ "$mysql_health" == "healthy" ]]; then
  ok "mysql healthy"
elif [[ "$mysql_health" == "starting" ]]; then
  deadline=$((SECONDS + 90))
  while (( SECONDS < deadline )); do
    mysql_health="$(docker inspect garz-puzzle-mysql --format '{{.State.Health.Status}}' 2>/dev/null || echo missing)"
    [[ "$mysql_health" == "healthy" ]] && break
    sleep 3
  done
  if [[ "$mysql_health" == "healthy" ]]; then
    ok "mysql healthy (after wait)"
  else
    bad "mysql health=$mysql_health"
  fi
else
  bad "mysql health=$mysql_health"
fi

note "==> Gateway HTTP"
gateway_code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 http://127.0.0.1:3000/ || echo 000)"
if [[ "$gateway_code" == "200" || "$gateway_code" == "302" ]]; then
  ok "gateway http://127.0.0.1:3000/ -> $gateway_code"
else
  bad "gateway http://127.0.0.1:3000/ -> $gateway_code"
fi

game_code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 http://127.0.0.1:3000/tilezilla-v2.html || echo 000)"
if [[ "$game_code" == "200" ]]; then
  ok "game /tilezilla-v2.html -> $game_code"
else
  bad "game /tilezilla-v2.html -> $game_code"
fi

api_body="$(curl -s --connect-timeout 5 http://127.0.0.1:3000/api/system-info || true)"
if [[ "$api_body" == *'"version"'* ]]; then
  ok "api /api/system-info responds"
else
  bad "api /api/system-info missing version"
fi

if (( CHECK_NGINX == 1 )) && command -v systemctl >/dev/null 2>&1; then
  note "==> Host nginx"
  if systemctl is-active --quiet nginx 2>/dev/null; then
    ok "nginx active"
  else
    warn "nginx not active (HTTPS front door may be down)"
  fi
fi

note ""
if (( failures == 0 )); then
  note "All checks passed."
  exit 0
fi

note "$failures check(s) failed. Logs:"
note "  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs --tail=40 gateway web php-auth mysql"
exit 1
