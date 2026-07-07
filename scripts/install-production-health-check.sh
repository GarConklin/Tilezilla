#!/usr/bin/env bash
# Install systemd unit so Tilezilla health check runs after every reboot.
#
# Usage (on Ubuntu VPS):
#   cd /opt/tilezilla
#   sudo ./scripts/install-production-health-check.sh
#   sudo ./scripts/install-production-health-check.sh /home/user/tilezilla deployuser
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_ROOT="${1:-$REPO_ROOT}"
RUN_AS_USER="${2:-${SUDO_USER:-root}}"
UNIT_NAME="tilezilla-health-check.service"
UNIT_SRC="$REPO_ROOT/scripts/systemd/$UNIT_NAME"
UNIT_DST="/etc/systemd/system/$UNIT_NAME"

if [[ ! -f "$UNIT_SRC" ]]; then
  echo "Missing $UNIT_SRC" >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-run with sudo." >&2
  exit 1
fi

chmod +x "$INSTALL_ROOT/scripts/health-check-production.sh"

tmp="$(mktemp)"
sed \
  -e "s|/opt/tilezilla|$INSTALL_ROOT|g" \
  -e "s|^User=.*|User=$RUN_AS_USER|" \
  "$UNIT_SRC" > "$tmp"
install -m 0644 "$tmp" "$UNIT_DST"
rm -f "$tmp"

systemctl daemon-reload
systemctl enable "$UNIT_NAME"
systemctl start "$UNIT_NAME" || true

echo ""
echo "Installed $UNIT_DST"
echo "  User:        $RUN_AS_USER"
echo "  Working dir: $INSTALL_ROOT"
echo ""
echo "Manual check:  $INSTALL_ROOT/scripts/health-check-production.sh"
echo "Boot status:   systemctl status $UNIT_NAME"
echo "Boot logs:     journalctl -u $UNIT_NAME -b"
