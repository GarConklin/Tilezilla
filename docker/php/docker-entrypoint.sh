#!/bin/bash
set -e

if [ ! -L /var/www/html/public/api ]; then
  if [ -d /var/www/html/api ]; then
    ln -sf /var/www/html/api /var/www/html/public/api
  fi
fi

if [ -f /usr/sbin/sendmail ]; then
  service sendmail start || true
fi

exec "$@"
