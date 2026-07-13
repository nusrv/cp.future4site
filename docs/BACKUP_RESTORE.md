# Backup And Restore

## Minimum Backups

- MariaDB database.
- Complete `FILE_STORAGE_PATH` directory or object bucket, including `knowledge-base` originals and every immutable version.
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

## Plesk Verification

Do not assume a Plesk subscription backup includes an external private storage path. Verify explicitly that both MariaDB and the configured absolute `FILE_STORAGE_PATH` are included, retained together, and restorable to the same logical point in time.

A Knowledge Library restore is incomplete if either database metadata or its matching private files are missing. Restore testing must include listing a document, opening its version timeline, and downloading at least one active and one archived version through the authenticated CP route.

