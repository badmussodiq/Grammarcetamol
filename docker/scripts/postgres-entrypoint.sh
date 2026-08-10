#!/bin/bash
# Wraps the official postgres image's own entrypoint so database provisioning runs on every
# container start, not just once on a brand-new volume. Starts postgres normally in the
# background, waits for it to accept connections, runs ensure-postgres-databases.sh, then waits
# on the postgres process so the container stays attached to it (signals still reach it via bash's
# default job-control forwarding, and the trap below makes `docker compose down` shut down clean).
set -e

docker-entrypoint.sh postgres &
PG_PID=$!
trap 'kill -TERM "$PG_PID" 2>/dev/null; wait "$PG_PID"' TERM INT

until pg_isready -U "$POSTGRES_USER" -h localhost -q; do
  sleep 1
done

bash /ensure-postgres-databases.sh

wait "$PG_PID"
