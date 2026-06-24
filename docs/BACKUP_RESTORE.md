# Backup And Restore

## Minimum Backups

- MariaDB database.
- Storage directory or object bucket.
- n8n workflow exports.
- `.env` values stored securely by the owner.
- Git release tag.

## Restore Test

Before production use, perform a restore into a non-production environment and verify:

- login;
- user roles;
- records;
- files;
- automation job history;
- audit events.

## Frequency

Owner decision required. Daily database backup is the minimum recommended starting point.

