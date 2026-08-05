#!/bin/bash
# Runs once, automatically, only on a brand-new postgres-data volume (the
# official postgres image only executes docker-entrypoint-initdb.d/ scripts
# when the data directory is empty). POSTGRES_DB already creates auth_db;
# this creates every additional per-service database. Add new services here.
set -e

for db in course_db enrollment_db payment_db review_db; do
  if ! psql -U "$POSTGRES_USER" -lqt | cut -d '|' -f 1 | grep -qw "$db"; then
    psql -U "$POSTGRES_USER" -c "CREATE DATABASE $db;"
  fi
done
