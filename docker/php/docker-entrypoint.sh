#!/bin/bash
set -e

if [ -f /usr/sbin/sendmail ]; then
  service sendmail start || true
fi

exec "$@"
