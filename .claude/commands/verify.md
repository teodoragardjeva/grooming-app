---
description: Run lint, typecheck, tests and build, then report honestly
---
Run, in order, and stop to fix on the first failure:
1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run test:db` (needs a local Postgres; if unavailable, say so explicitly)
5. `npm run build`

Report exactly which commands ran and their results. Never claim a check passed if it was not run.
