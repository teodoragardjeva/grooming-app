# n8n with the chatbot workflow baked in. On every container start the workflow is imported from git
# (overwriting the copy in the n8n volume) and activated, then n8n starts normally.
# Pinned to what `latest` resolved to on 2026-11-14. Bump deliberately and re-test the import.
FROM n8nio/n8n:2.47.7

COPY --chown=node:node grooming-chatbot.workflow.json /opt/workflow.json
COPY --chown=node:node --chmod=0755 import-workflow.sh /opt/import-workflow.sh

ENTRYPOINT ["/opt/import-workflow.sh"]
