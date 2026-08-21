#!/bin/bash
# Idempotent TLS cert bootstrap — checks which of this .env's configured domains don't
# have a certificate yet, and issues only those. Safe to call on EVERY deploy: no-ops
# entirely once every configured domain already has a cert (the common case after the
# first successful run). Called automatically from deploy.sh — not meant to be run by
# hand, though it's safe to.
#
# Handles both cases that need real certbot --standalone (which needs port 80 free to
# run its own verification server):
#   - First-ever bootstrap: nginx isn't running yet, port 80 is already free.
#   - Adding a NEW domain after nginx is already live (e.g. turning on the development
#     domains after production's been serving real HTTPS for a while): nginx already
#     owns port 80, so it's stopped for the few seconds certbot needs, then restarted.
#     This is real, deliberate, brief downtime for what's a rare, one-time event per
#     domain — not something that happens on routine deploys, since routine deploys hit
#     the "nothing missing, skip" path and never touch nginx at all.
#
# Must run from the deploy directory (docker-compose.yml + docker/ already present) with
# .env already sourced into this shell's environment — see deploy.sh.
set -euo pipefail

if [[ "${COMPOSE_PROFILES:-}" != *proxy* ]]; then
  echo "certbot-bootstrap: COMPOSE_PROFILES doesn't include 'proxy' — nginx/TLS not in use, nothing to do."
  exit 0
fi

DOMAINS=()
for var in DOMAIN_APP DOMAIN_ADMIN DOMAIN_API DOMAIN_APP_DEV DOMAIN_ADMIN_DEV DOMAIN_API_DEV; do
  value="${!var:-}"
  [[ -n "$value" ]] && DOMAINS+=("$value")
done

if [[ ${#DOMAINS[@]} -eq 0 ]]; then
  echo "certbot-bootstrap: proxy profile is on but no DOMAIN_* vars are set — nothing to do."
  exit 0
fi

MISSING=()
for domain in "${DOMAINS[@]}"; do
  if docker compose run --rm --entrypoint sh certbot -c "test -f /etc/letsencrypt/live/$domain/fullchain.pem" 2>/dev/null; then
    echo "certbot-bootstrap: cert already exists for $domain — skipping."
  else
    echo "certbot-bootstrap: no cert yet for $domain."
    MISSING+=("$domain")
  fi
done

if [[ ${#MISSING[@]} -eq 0 ]]; then
  echo "certbot-bootstrap: every configured domain already has a cert — nothing to do."
  exit 0
fi

echo "certbot-bootstrap: issuing certs for: ${MISSING[*]}"

WAS_RUNNING=false
if docker compose ps --status running nginx 2>/dev/null | grep -q nginx; then
  WAS_RUNNING=true
  echo "certbot-bootstrap: nginx is currently running — stopping briefly to free port 80."
  docker compose stop nginx
fi

for domain in "${MISSING[@]}"; do
  docker compose run --rm -p 80:80 --entrypoint certbot certbot \
    certonly --standalone -d "$domain" \
    --email "${CERTBOT_EMAIL:?CERTBOT_EMAIL must be set in .env to bootstrap a new cert}" \
    --agree-tos --no-eff-email
done

if [[ "$WAS_RUNNING" == true ]]; then
  echo "certbot-bootstrap: restarting nginx."
  docker compose up -d nginx
fi

echo "certbot-bootstrap: done."
