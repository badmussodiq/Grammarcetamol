#!/bin/bash
# Wraps the official mongo image's own entrypoint so database provisioning runs on every
# container start. Starts mongod normally in the background, waits for it to accept connections,
# runs ensure-mongo-databases.sh, then waits on the mongod process so the container stays
# attached to it (the trap makes `docker compose down` shut down clean).
set -e

docker-entrypoint.sh mongod &
MONGO_PID=$!
trap 'kill -TERM "$MONGO_PID" 2>/dev/null; wait "$MONGO_PID"' TERM INT

until mongosh --quiet --eval "db.adminCommand('ping')" \
  "mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@localhost:27017/?authSource=admin" \
  >/dev/null 2>&1; do
  sleep 1
done

MONGO_USERNAME="$MONGO_INITDB_ROOT_USERNAME" MONGO_PASSWORD="$MONGO_INITDB_ROOT_PASSWORD" bash /ensure-mongo-databases.sh

wait "$MONGO_PID"
