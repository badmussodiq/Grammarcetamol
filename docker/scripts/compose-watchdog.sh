#!/bin/bash
# Auto-heal a stalled Grammarcetamol Docker Compose stack. Runs `docker compose up -d`,
# which is idempotent: containers that are already healthy/running are left alone; only
# ones stuck in "Created"/"Exited" (e.g. from a Docker daemon hiccup inside WSL2 losing
# track of a just-recreated container's "should be running" state) get started.
#
# Logs every run to a rotating-by-size file so a runaway timer doesn't fill the disk.
#
# No explicit -p on any `docker compose` call below (same reasoning as deploy.sh) —
# resolves the project from REPO_ROOT's own .env (COMPOSE_PROJECT_NAME) or its directory
# basename. Matters because this script (and its systemd timer) gets deployed once PER
# environment — e.g. /opt/grammarcetamol-dev/docker/scripts/compose-watchdog.sh needs to
# heal the development stack, not accidentally target production's.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_FILE="$REPO_ROOT/docker/scripts/watchdog.log"
MAX_LOG_BYTES=$((5 * 1024 * 1024))

if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)" -gt "$MAX_LOG_BYTES" ]; then
  mv "$LOG_FILE" "$LOG_FILE.1"
fi

{
  echo "=== $(date -Iseconds) ==="
  cd "$REPO_ROOT"

  # Nothing to heal if the stack was never started (down/not created) — don't force it up
  # unasked; the watchdog's job is to recover a stack that's supposed to be running, not
  # to start one from scratch.
  if ! docker compose ps --format json 2>/dev/null | grep -q .; then
    echo "Stack not running (no containers found) — skipping."
    exit 0
  fi

  STALLED=$(docker compose ps -a --format '{{.Name}} {{.State}}' 2>/dev/null | grep -vE ' (running)$' || true)
  if [ -z "$STALLED" ]; then
    echo "All containers running — nothing to do."
    exit 0
  fi

  echo "Stalled containers found:"
  echo "$STALLED"
  echo "Running: docker compose up -d"
  docker compose up -d
  echo "Done."
} >> "$LOG_FILE" 2>&1
