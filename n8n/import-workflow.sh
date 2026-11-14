#!/bin/sh
# Imports and activates /opt/workflow.json, then starts n8n through the image's normal entrypoint.
# An import/activation failure is logged but never prevents n8n from starting.
WF=/opt/workflow.json

ID=$(node -e "process.stdout.write(String(require('$WF').id || ''))" 2>/dev/null)

if [ -z "$ID" ]; then
  echo "[workflow-import] ERROR: $WF has no id; skipping import" >&2
else
  echo "[workflow-import] importing workflow $ID"
  if n8n import:workflow --input="$WF"; then
    # n8n 2.x: publish:workflow. n8n 1.x: update:workflow --active=true.
    if n8n publish:workflow --id="$ID" || n8n update:workflow --id="$ID" --active=true; then
      echo "[workflow-import] workflow $ID imported and activated"
    else
      echo "[workflow-import] WARNING: imported but could not activate $ID" >&2
    fi
  else
    echo "[workflow-import] ERROR: import failed; starting n8n anyway" >&2
  fi
fi

exec tini -- /docker-entrypoint.sh "$@"
