#!/usr/bin/env bash
# Install systemd timer for weekly Tilezilla soft restart (Wednesday ~03:00).
#
# Usage (on Ubuntu VPS):
#   cd /opt/tilezilla
#   sudo ./scripts/install-production-weekly-restart.sh
#   sudo ./scripts/install-production-weekly-restart.sh /opt/tilezilla ubuntu
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_ROOT="${1:-$REPO_ROOT}"
RUN_AS_USER="${2:-${SUDO_USER:-root}}"
SERVICE_NAME="tilezilla-weekly-restart.service"
TIMER_NAME="tilezilla-weekly-restart.timer"
SERVICE_SRC="$REPO_ROOT/scripts/systemd/$SERVICE_NAME"
TIMER_SRC="$REPO_ROOT/scripts/systemd/$TIMER_NAME"
SERVICE_DST="/etc/systemd/system/$SERVICE_NAME"
TIMER_DST="/etc/systemd/system/$TIMER_NAME"

if [[ ! -f "$SERVICE_SRC" || ! -f "$TIMER_SRC" ]]; then
  echo "Missing systemd unit files under scripts/systemd/" >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-run with sudo." >&2
  exit 1
fi

chmod +x "$INSTALL_ROOT/scripts/weekly-restart-production.sh"
chmod +x "$INSTALL_ROOT/scripts/health-check-production.sh" 2>/dev/null || true

tmp="$(mktemp)"
sed \
  -e "s|/opt/tilezilla|$INSTALL_ROOT|g" \
  -e "s|^User=.*|User=$RUN_AS_USER|" \
  "$SERVICE_SRC" > "$tmp"
install -m 0644 "$tmp" "$SERVICE_DST"
rm -f "$tmp"
install -m 0644 "$TIMER_SRC" "$TIMER_DST"

systemctl daemon-reload
systemctl enable --now "$TIMER_NAME"

echo ""
echo "Installed weekly restart timer"
echo "  User:        $RUN_AS_USER"
echo "  Working dir: $INSTALL_ROOT"
echo "  Schedule:    Wednesday 03:00 (VPS local time) + up to 5m jitter"
echo "  Restarts:    gateway, web, php-auth (MySQL stays up)"
echo ""
echo "Next run:      systemctl list-timers $TIMER_NAME"
echo "Status:        systemctl status $TIMER_NAME"
echo "Manual once:   sudo systemctl start $SERVICE_NAME"
echo "Logs:          journalctl -u $SERVICE_NAME -n 50 --no-pager"
echo "               tail -n 50 $INSTALL_ROOT/data/weekly-restart.log"
