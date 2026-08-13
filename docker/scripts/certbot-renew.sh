#!/bin/bash
# Renews Let's Encrypt certificates via the webroot method (nginx is already running and
# serving /.well-known/acme-challenge/ from the shared certbot-webroot volume, so unlike
# the one-time --standalone bootstrap, nginx does NOT need to stop for this). certbot
# no-ops if nothing is within its renewal window (default: 30 days before expiry), so this
# is safe to run frequently — see README.md's "Deploying to a cloud server" section for
# how to schedule it (a systemd timer, same pattern as compose-watchdog.sh/.timer).
#
# Usage: certbot-renew.sh   (run from the deploy directory, e.g. /opt/grammarcetamol)
set -euo pipefail

cd "$(dirname "$0")/../.."

docker compose -p grammarcetamol run --rm certbot renew --webroot -w /var/www/certbot --quiet
docker compose -p grammarcetamol exec nginx nginx -s reload
