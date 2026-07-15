# Release Notes

## 2026-07-15 knowledge-platform deployment checkpoint

- Phase 1A, Phase 1B, and the Phase 1C manual pilot are owner-accepted.
- Deterministic extraction, explicit OCR records, provider-gated claim candidates, exact approved-claim resolution, and evidence-backed generation are implemented as independently controlled gates.
- Plesk passed Prisma Client generation, 23 test files/141 tests, client/server TypeScript, and the production build.
- MariaDB successfully applied all pending migrations, including the four additive 2026-07-15 knowledge migrations.
- Local OCR remains disabled on shared Plesk; a separate Future OCR API and later CP adapter are planned.
- Candidate generation and evidence-backed generation remain disabled pending their provider, evaluation, workflow, and operational gates.
- Semantic retrieval remains deferred pending measured need.

## admin-v0.1.0

Initial internal management platform package:

- Node.js/Fastify/React/Prisma foundation.
- Internal username/password authentication.
- Role-based admin and staff interface.
- Operational records for leads, inquiries, organizations, suppliers, deals, and tasks.
- Marketing Studio with content request and approval flow.
- Automation job protocol and callback endpoint.
- Publishing command model with dry-run separation.
- Sanitized n8n draft exports.
- Deployment, security, storage, backup, and testing documentation.

