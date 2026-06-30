#!/bin/bash
set -e

# Apache serves public/; API lives in api/ (mounted sibling). Symlink for /api/* only.
if [ ! -e /var/www/html/public/api ]; then
  if [ -d /var/www/html/api ]; then
    ln -sfn ../api /var/www/html/public/api
  fi
fi

exec "$@"
