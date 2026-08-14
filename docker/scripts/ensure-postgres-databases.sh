#!/bin/bash
# Idempotent: checks each database individually and creates only the ones missing. Invoked by
# postgres-entrypoint.sh on every container start (not just a brand-new volume), so it also
# recovers from a database being manually dropped/cleared without touching the volume. Runs
# inside the postgres container itself against localhost. Add new services here.
set -e
: "${POSTGRES_HOST:=localhost}"
export PGPASSWORD="$POSTGRES_PASSWORD"

for db in auth_db course_db enrollment_db upload_db payment_db review_db; do
  exists=$(psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'")
  if [ "$exists" = "1" ]; then
    echo "postgres: $db already exists"
  else
    echo "postgres: creating $db"
    psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $db;"
  fi
done
