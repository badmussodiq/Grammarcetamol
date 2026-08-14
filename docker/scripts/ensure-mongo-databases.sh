#!/bin/bash
# MongoDB has no CREATE DATABASE — a database only becomes visible (e.g. in mongosh/Compass)
# once it holds at least one collection, which normally happens lazily on the app's first write.
# This creates a marker collection ("_init") up front so the database exists immediately at
# startup. Invoked by mongo-entrypoint.sh on every container start, inside the mongo container
# itself against localhost. Add new services here.
set -e
: "${MONGO_HOST:=localhost}"
: "${MONGO_PORT:=27017}"

for db in notification_db; do
  mongosh "mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/?authSource=admin" --quiet --eval "
    (function () {
      var target = db.getSiblingDB('$db');
      if (target.getCollectionNames().indexOf('_init') === -1) {
        target.createCollection('_init');
        print('mongo: created $db');
      } else {
        print('mongo: $db already exists');
      }
    })();
  "
done
