#!/usr/bin/env bash
# On the MANAGER VM: live farm status (solved / waiting / in progress / failed, rate, ETA, per VM).
# Refreshes every 5 seconds; Ctrl+C to quit (the farm keeps running).
#
#   bash tools/swarm/watch.sh            # or: bash tools/swarm/watch.sh 10   (seconds)
source "$(dirname "${BASH_SOURCE[0]}")/farm-common.sh"
admin_run watch --interval "${1:-5}"
