#!/usr/bin/env bash
# Restore a deploy export on Ubuntu and start the production stack.
#
# Usage:
#   ./scripts/restore-on-ubuntu.sh deploy-export/20260629-120000
#   ./scripts/restore-on-ubuntu.sh   # uses newest folder under deploy-export/
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

IMPORT_DIR="${1:-}"
if [[ -z "$IMPORT_DIR" ]]; then
  IMPORT_DIR="$(ls -dt deploy-export/*/ 2>/dev/null | head -1 || true)"
fi
if [[ -z "$IMPORT_DIR" || ! -d "$IMPORT_DIR" ]]; then
  echo "Usage: $0 <path-to-export-folder>" >&2
  echo "Example: $0 deploy-export/20260629-120000" >&2
  exit 1
fi
IMPORT_DIR="$(cd "$IMPORT_DIR" && pwd)"

SQL_FILE="$IMPORT_DIR/tilegame.sql"
if [[ ! -f "$SQL_FILE" ]]; then
  echo "Missing $SQL_FILE" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. See Docs/deploy-ubuntu.md" >&2
  exit 1
fi

ENV_FILE="$REPO_ROOT/.env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$IMPORT_DIR/.env.production" ]]; then
    cp "$IMPORT_DIR/.env.production" "$ENV_FILE"
  else
    cp "$REPO_ROOT/.env.production.example" "$ENV_FILE"
    echo "Created $ENV_FILE from example — edit passwords and APP_BASE_URL before going live." >&2
  fi
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

ROOT_PASS="${MYSQL_ROOT_PASSWORD:-root_dev_change_me}"
DB_NAME="${MYSQL_DATABASE:-tilegame}"

echo "==> Ensure MySQL volume"
docker volume inspect tilezilla_shared_mysql_data >/dev/null 2>&1 \
  || docker volume create tilezilla_shared_mysql_data >/dev/null

echo "==> Start MySQL only"
docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" up -d mysql

echo "==> Wait for MySQL healthy"
deadline=$((SECONDS + 120))
while (( SECONDS < deadline )); do
  health="$(docker inspect garz-puzzle-mysql --format '{{.State.Health.Status}}' 2>/dev/null || echo starting)"
  if [[ "$health" == "healthy" ]]; then
    break
  fi
  sleep 3
done
if [[ "$health" != "healthy" ]]; then
  echo "MySQL did not become healthy in time. Check: docker logs garz-puzzle-mysql" >&2
  exit 1
fi

echo "==> Import tilegame.sql"
docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" \
  exec -T mysql mysql -uroot -p"$ROOT_PASS" -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`;"

docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" \
  exec -T mysql mysql -uroot -p"$ROOT_PASS" "$DB_NAME" < "$SQL_FILE"

if [[ -f "$IMPORT_DIR/solves.zip" && ! -d "$REPO_ROOT/solves" ]]; then
  echo "==> Extract solves.zip"
  unzip -q "$IMPORT_DIR/solves.zip" -d "$REPO_ROOT"
fi

if [[ ! -d "$REPO_ROOT/auth/config" ]]; then
  mkdir -p "$REPO_ROOT/auth/config"
fi
if [[ ! -f "$REPO_ROOT/auth/config/config.php" ]]; then
  cp "$REPO_ROOT/auth/config/config.example.php" "$REPO_ROOT/auth/config/config.php"
fi

echo "==> Start full production stack"
docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" up -d --build

echo ""
echo "Restore complete."
echo "  Gateway (local): http://127.0.0.1:3000/tilezilla-v2.html"
echo "  Auth (local):    http://127.0.0.1:3001/register.html"
echo "  Public URL:      ${APP_BASE_URL:-https://tile.skifflakegames.com}/tilezilla-v2.html"
echo ""
echo "Next: configure host nginx HTTPS and mail relay — Docs/deploy-ubuntu.md"
