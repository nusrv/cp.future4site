# Architecture

The platform is a single deployable Node.js application:

- Fastify serves `/api/*` and the built React app.
- Prisma manages MariaDB-compatible schema and migrations.
- React handles the internal staff interface.
- n8n remains the workflow engine.
- External services such as Magnific, Meta, SMTP, and future LLM providers are accessed from server-side workflows or backend code only.

## Boundaries

- Public website: separate, not modified here.
- Customers and suppliers: internal records, not platform users.
- n8n: automation execution layer, not the system of record.
- Database: operational system of record for platform records.
- Markdown Knowledge Base: canonical source for approved claims and evidence until one-way sync is implemented.

## Deployment Shape

Production should run one Node process behind Plesk with:

- `npm run build`
- `npm run db:migrate`
- `npm start`

The owner configures subdomain, SSL, production database, storage path, and secrets in Plesk.

