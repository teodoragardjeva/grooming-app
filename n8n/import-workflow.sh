#!/bin/sh
# Imports and activates /opt/workflow.json when it differs from the last successfully imported version,
# then starts n8n through the image's normal entrypoint.
# - Restarts with an unchanged workflow skip the import (no editor changes are overwritten, no extra n8n CLI boots).
# - A failed import/activation is logged, never blocks n8n, and is retried on the next start (the hash is only
#   recorded after success). This also covers the first start on a fresh volume, before the owner/credentials exist.
WF=/opt/workflow.json
STATE_DIR="${N8N_USER_FOLDER:-/home/node}/.n8n"
HASH_FILE="$STATE_DIR/.workflow-import-sha256"

ID=$(node -e "process.stdout.write(String(require('$WF').id || ''))" 2>/dev/null)
HASH=$(sha256sum "$WF" | cut -d' ' -f1)

if [ -z "$ID" ]; then
  echo "[workflow-import] ERROR: $WF has no id; skipping import" >&2
elif [ -f "$HASH_FILE" ] && [ "$(cat "$HASH_FILE")" = "$HASH" ]; then
  echo "[workflow-import] workflow $ID unchanged since the last import; skipping"
else
  echo "[workflow-import] importing workflow $ID"
  if n8n import:workflow --input="$WF"; then
    # n8n 2.x: publish:workflow. n8n 1.x: update:workflow --active=true.
    if n8n publish:workflow --id="$ID" || n8n update:workflow --id="$ID" --active=true; then
      mkdir -p "$STATE_DIR" && echo "$HASH" > "$HASH_FILE"
      echo "[workflow-import] workflow $ID imported and activated"
    else
      echo "[workflow-import] WARNING: imported but could not activate $ID; will retry on next start" >&2
    fi
  else
    echo "[workflow-import] ERROR: import failed; starting n8n anyway, will retry on next start" >&2
  fi
fi

# The base image starts n8n via tini; fall back to calling its entrypoint directly if tini is absent.
if command -v tini >/dev/null 2>&1; then
  exec tini -- /docker-entrypoint.sh "$@"
fi
exec /docker-entrypoint.sh "$@"
