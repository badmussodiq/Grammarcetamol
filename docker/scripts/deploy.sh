#!/bin/bash
# Server-side deploy script. Run from inside the deploy directory (e.g. /opt/grammarcetamol)
# AFTER that directory's docker-compose.yml + docker/ have already been refreshed (the CI
# deploy step scps them fresh before invoking this). No git here on purpose — the server
# only ever runs pre-built images pulled from the registry, it never needs the source tree.
#
# Usage: deploy.sh <image-tag>   (CI passes the commit SHA it just built and pushed)
#
# Relies on IMAGE_PREFIX and IMAGE_PULL_POLICY=always already being set in this directory's
# own .env — written fresh by the CI deploy step on every run (from the ENV_FILE GitHub
# Environment secret / prod-env-file Jenkins credential — see README.md's "Deploying to a
# cloud server" section), not created here by hand — so `docker compose pull` actually
# hits the registry instead of the local-dev "build" default. IMAGE_TAG is the one value
# that changes per deploy, so it's passed here instead of living in .env.
#
# Compose project name comes from this directory's own .env (COMPOSE_PROJECT_NAME — a
# variable name `docker compose` reads from .env natively) — NOT hardcoded to
# "grammarcetamol" anymore. Two environments (e.g. production and development) deployed to
# separate directories on the same host, each with its own COMPOSE_PROJECT_NAME in .env,
# get fully isolated containers/networks/volumes for free. An existing production .env that
# predates this change has no COMPOSE_PROJECT_NAME set, so `docker compose` falls back to
# its own default (the directory's basename, e.g. "grammarcetamol" for /opt/grammarcetamol)
# — matches this script's original hardcoded behavior exactly, no .env change required.
set -euo pipefail

TAG="${1:?Usage: deploy.sh <image-tag>}"
export IMAGE_TAG="$TAG"

# Every other step below (DATA_DIR, COMPOSE_PROFILES, DOMAIN_*, CERTBOT_EMAIL) needs these
# actually present in THIS shell's own environment, not just visible to `docker compose`'s
# own separate .env auto-read — `set -a` exports every var sourced from here on.
set -a
# shellcheck source=/dev/null
source .env
set +a

# Data directories are bind-mounted (see docker/docker-compose.dev.yml's DATA_DIR), not
# Docker named volumes — they need to exist as real host directories before the first
# `docker compose up`, or Docker root-creates them implicitly with root ownership, which
# can then fight with a container's own non-root user over write permissions. Idempotent:
# a no-op every deploy after the first.
DATA_ROOT="${DATA_DIR:-../data}"
mkdir -p "$DATA_ROOT"/{postgres,redis,rabbitmq,minio,mongo}

# Auto-enable serving the development domains through this (production) nginx, once
# they're actually configured — copies the opt-in templates from templates-dev/ into the
# live templates/ directory that gets mounted into the nginx container. Safe to do
# unconditionally on every deploy: cheap file copy, and certbot-bootstrap.sh below always
# runs BEFORE `docker compose up -d`, so by the time nginx actually starts, any cert these
# templates reference either already existed or was just issued — nginx never starts
# pointed at a template whose cert doesn't exist yet.
if [[ -n "${DOMAIN_APP_DEV:-}${DOMAIN_ADMIN_DEV:-}${DOMAIN_API_DEV:-}" ]]; then
  echo "Development domain(s) configured — enabling docker/nginx/templates-dev/*.template"
  cp docker/nginx/templates-dev/*.template docker/nginx/templates/
fi

#docker compose down
# Retries a few times before giving up — a single transient registry timeout (Docker Hub
# occasionally drops a layer request mid-pull) shouldn't fail an otherwise-healthy deploy.
for attempt in 1 2 3; do
  if docker compose pull; then
    break
  elif [[ "$attempt" == 3 ]]; then
    echo "docker compose pull failed after 3 attempts — giving up." >&2
    exit 1
  else
    echo "docker compose pull failed (attempt $attempt/3) — retrying in 10s..." >&2
    sleep 10
  fi
done

# Idempotent — issues certs only for whichever configured domains don't have one yet, and
# is a fast no-op once they all do (the common case). Must run before `up -d` below: nginx
# validates every ssl_certificate path at startup and refuses to start if one is missing.
bash docker/scripts/certbot-bootstrap.sh

docker compose up -d

# Every deploy pulls a NEW commit-sha-tagged image per service, and the OLD one becomes
# unused (no container references it anymore) but stays on disk otherwise — with a deploy
# on every push to master, that's an unbounded, ever-growing pile of old image layers.
# `docker image prune -af` removes every image with zero containers referencing it, which
# by construction can never touch what's actually running (the containers `up -d` just
# (re)started above are still using their images) — so this is safe to run unconditionally
# right after `up -d`, not just "probably fine." Rolling back to an older commit later just
# means `deploy.sh <old-sha>` re-pulls it fresh from the registry — that's the accepted
# tradeoff for not keeping every historical image locally.
echo "Pruning unused images..."
docker image prune -af
