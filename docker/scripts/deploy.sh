#!/bin/bash
# Server-side deploy script. Run from inside the deploy directory (e.g. /opt/grammarcetamol)
# AFTER that directory's docker-compose.yml + docker/ have already been refreshed (the CI
# deploy step scps them fresh before invoking this). No git here on purpose — the server
# only ever runs pre-built images pulled from the registry, it never needs the source tree.
#
# Usage: deploy.sh <image-tag>   (CI passes the commit SHA it just built and pushed)
#
# Relies on IMAGE_PREFIX and IMAGE_PULL_POLICY=always already being set in this directory's
# own .env — written fresh by the CI deploy step on every run (from the PROD_ENV_FILE
# GitHub Actions secret / prod-env-file Jenkins credential — see README.md's "Deploying
# to a cloud server" section), not created here by hand — so `docker compose pull`
# actually hits the registry instead of the local-dev "build" default. IMAGE_TAG is the
# one value that changes per deploy, so it's passed here instead of living in .env.
set -euo pipefail

TAG="${1:?Usage: deploy.sh <image-tag>}"
export IMAGE_TAG="$TAG"

docker compose -p grammarcetamol down
docker compose -p grammarcetamol pull
docker compose -p grammarcetamol up -d

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
