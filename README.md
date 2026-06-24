# Future Foresight Admin Platform

Internal administration platform for Future Foresight staff. It is not a customer portal, supplier portal, public registration system, or public website.

## Scope

- Internal login with username and password.
- User, role, session, and audit management.
- Lead, inquiry, organization, contact, supplier, customer, task, and deal records.
- Marketing Studio for internal content requests, review, revision, and approval.
- Automation job tracking for n8n and external services.
- Separate Facebook/Instagram publishing commands with dry-run support.
- Local file metadata and storage references for generated assets and documents.

## Stack

- Node.js 20+
- TypeScript
- Fastify API/backend
- React, Vite, React Router, TanStack Query
- Tailwind CSS
- Prisma ORM
- MariaDB/MySQL provider, production target MariaDB 11.4.7
- Argon2id password hashing
- Secure HTTP-only cookie sessions
- Vitest and Playwright test foundations

## Quick Start

```bash
npm install
npm run db:generate
cp .env.example .env
npm run db:migrate
npm run admin:bootstrap
npm run dev
```

Use synthetic data only until production credentials, access rules, backup, and deployment are approved.

## Required Documents

- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT_PLESK.md`
- `docs/ENVIRONMENT_VARIABLES.md`
- `docs/DATABASE_SETUP.md`
- `docs/DATABASE_MIGRATIONS.md`
- `docs/N8N_INTEGRATION.md`
- `docs/WORKFLOW_INVENTORY.md`
- `docs/WORKFLOW_ACTIVATION.md`
- `docs/META_INTEGRATION.md`
- `docs/FILE_STORAGE.md`
- `docs/BACKUP_RESTORE.md`
- `docs/SECURITY_CHECKLIST.md`
- `docs/USER_ADMINISTRATION.md`
- `docs/MOCK_AND_DRY_RUN.md`
- `docs/TESTING.md`
- `docs/OPERATIONS_RUNBOOK.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/RELEASE_NOTES.md`

## Safety Rules

- Do not commit `.env` or secrets.
- Do not store SMTP, Meta, n8n, Magnific, database, or API tokens in normal tables.
- Browser code must never receive n8n credentials.
- Publishing requires explicit internal approval and a separate publish action.
- Supplier-confidential fields are restricted and must not be passed to marketing or public content workflows.
- Existing public `Website/` files are out of scope and must not be modified by this project.

