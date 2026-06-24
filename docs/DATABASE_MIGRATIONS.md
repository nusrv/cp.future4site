# Database Migrations

Prisma migrations are stored in `prisma/migrations/`.

## Rules

- Migrations are not run during build.
- Production migrations are owner-controlled.
- Back up production before applying migrations.
- Never edit an already-applied production migration.

## Development

```bash
npm run db:migrate:dev
```

## Production

```bash
npm run db:migrate
```

## Rollback

Prisma does not provide automatic down migrations. Production rollback requires restoring a database backup and reverting the app release tag.

