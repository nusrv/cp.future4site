# Database Setup

Production target: MariaDB 11.4.7 through Plesk.

## Database

- Recommended database name: `cp_future_admin`
- Charset: `utf8mb4`
- Collation: `utf8mb4_unicode_ci`
- Access: dedicated database user with only required privileges

## Commands

```bash
npm run db:generate
npm run db:migrate
npm run admin:bootstrap
```

## Data Policy

- Use synthetic seed data only in local development.
- Do not migrate live n8n Data Table rows until backup, mapping, PII rules, and rollback are approved.
- Supplier-confidential data must only move after permission testing.

