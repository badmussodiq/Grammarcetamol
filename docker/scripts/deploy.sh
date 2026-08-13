#!/bin/bash
# Server-side deploy script. Run from inside the deploy directory (e.g. /opt/grammarcetamol)
# AFTER that directory's docker-compose.yml + docker/ have already been refreshed (the CI
# deploy step scps them fresh before invoking this). No git here on purpose — the server
# only ever runs pre-built images pulled from the registry, it never needs the source tree.
#
# Usage: deploy.sh <image-tag>   (CI passes the commit SHA it just built and pushed)
#
# Relies on IMAGE_PREFIX and IMAGE_PULL_POLICY=always already being set in this directory's
# own .env (created once by hand — see README.md's "Deploying to a cloud server" section),
# so `docker compose pull` actually hits the registry instead of the local-dev "build"
# default. IMAGE_TAG is the one value that changes per deploy, so it's passed here instead
# of living in .env.
set -euo pipefail

TAG="${1:?Usage: deploy.sh <image-tag>}"
export IMAGE_TAG="$TAG"

docker compose -p grammarcetamol pull
docker compose -p grammarcetamol up -d
