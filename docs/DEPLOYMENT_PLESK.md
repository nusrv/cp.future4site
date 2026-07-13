# Plesk Deployment

## Phase 1B deployment gate

Phase 1B has been statically reviewed only. Neither migration 202607130002_human_review_approved_claims nor 202607130003_claim_supersession_guard has been executed against MariaDB, and the release has not been built or deployed from the Google Drive workspace.

Before changing production:

1. Put the CP into a maintenance window and record the currently deployed Git commit.
2. Create a restorable MariaDB backup and verify it can be read.
3. Back up the complete private FILE_STORAGE_PATH without changing its ownership or paths.
4. Record row counts for KnowledgeDocument, KnowledgeDocumentVersion, FileObject, Document, KnowledgeIndex, Product, and PackagingFormat.
5. Pull the approved develop commit into the Plesk checkout.

Run these deferred validation gates from that exact checkout:

```bash
npm run db:generate
npx prisma validate
npm test
npm run typecheck
npm run build
npm run db:migrate
```

Prisma Client regeneration must complete before typecheck and build. Do not run db:migrate unless schema validation, tests, typecheck, build, the MariaDB backup, and the private-storage backup have succeeded.

After migration:

1. Verify the Prisma migration table records both Phase 1B migrations as successful.
2. Verify the new tables, nullable revision-replacement column, indexes, and foreign keys exist in MariaDB.
3. Recheck the pre-migration legacy row counts and confirm existing Phase 1A document/version/file associations are intact.
4. Restart the Passenger application and verify GET /health plus authenticated CP login.
5. Run the smoke tests below before ending the maintenance window.

### Phase 1B smoke tests

1. Source review: submit and begin review on an active version, approve it, and confirm reviewer/approver timestamps and history.
2. Replacement safety: upload a replacement, confirm it is not auto-approved, reject it, and confirm the earlier approved source remains approved.
3. Claim creation: create a draft with explicit applicability and an approved immutable source; confirm no storage key or filesystem path appears.
4. Translation review: edit and review English and Arabic independently; confirm one locale transition does not alter the other.
5. Supersession: create a draft revision from an approved claim, approve the new revision, confirm the prior revision becomes SUPERSEDED, and retry the stale action to confirm it fails safely.
6. Permissions: verify OWNER_ADMIN override, MARKETING draft-only behavior, CONTENT_REVIEWER review/approval behavior, READ_ONLY_MANAGEMENT read-only behavior, and no access for unauthorized roles.
7. Regression: confirm existing document list, authenticated download, replacement history, archive, and restore still work.
8. Boundary: confirm no AI generation, Gemini, n8n, extraction, OCR, embedding, resolver, or publishing job is dispatched.

### Phase 1B rollback

If failure occurs before db:migrate, restore the previous Git commit and restart; the database is unchanged. If migration succeeded but no Phase 1B operator data was created, the safest complete rollback is to stop the app, restore the pre-migration MariaDB backup, restore the previous Git commit, restart, and verify health/login plus a Phase 1A document download.

If operators created Phase 1B review or claim history, do not manually drop tables or columns. Stop writes, retain the database and private-storage backups, and choose either an application-only rollback that leaves additive tables unused or a coordinated point-in-time database restore approved by the owner. Never delete or rewrite private source files during rollback.

## Owner Responsibilities

- Create protected subdomain.
- Configure SSL.
- Create MariaDB 11.4.7 database `cp_future_admin` or equivalent.
- Configure production `.env` values.
- Configure Node.js app startup in Plesk.
- Configure persistent storage path.
- Run migrations and bootstrap the first administrator.

## Build Contract

```bash
npm ci
npm run build
npm run db:migrate
npm run admin:bootstrap
npm start
```

## Start Command

```bash
npm start
```


## Private Persistent Storage

Before starting the application, create a persistent private directory that is not replaced by Git pulls or deployment builds:

```bash
mkdir -p /var/www/vhosts/YOUR-DOMAIN/private/cp-storage/images
mkdir -p /var/www/vhosts/YOUR-DOMAIN/private/cp-storage/knowledge-base
```

Configure production `.env`:

```env
FILE_STORAGE_DRIVER=local
FILE_STORAGE_PATH=/var/www/vhosts/YOUR-DOMAIN/private/cp-storage
MAX_UPLOAD_MB=25
```

Production `FILE_STORAGE_PATH` must be absolute and remain outside `httpdocs`, the Git checkout, and every release/build directory. Grant only the effective Plesk/Passenger application user read and write permission to the storage root; do not make it web-readable. Confirm that runtime user before setting ownership. Use restrictive owner/group permissions appropriate to the actual Plesk configuration.

Uploaded media and Knowledge Library originals are private and are served only through authenticated CP routes. Phase 1A does not provide extraction, AI integration, or an antivirus guarantee when a file reports `SCAN_UNAVAILABLE`.

Cloudflare, Nginx, Passenger, Plesk, and Fastify multipart limits can each reject an upload before application validation. Keep their request-body limits at or above `MAX_UPLOAD_MB` without increasing the application default beyond 25 MB in this phase.

## Public Brand Assets

The tracked runtime asset package lives at `public/assets/`. Vite copies it to `dist-client/assets/` during `npm run build`, and the running CP serves it at `/assets/`.

After pulling a commit that changes brand assets:

```bash
npm ci
npm run build
# restart the CP application
```

Verify:

```bash
test -f public/assets/brand-profile.json
test -f dist-client/assets/brand-profile.json
```

Example public URL:

```text
https://YOUR-CP-DOMAIN/assets/logo/future-oils-logo.png
```

For n8n local access, mount the Git checkout source directory, not `dist-client`, because build output is replaceable:

```yaml
volumes:
  - /ABSOLUTE-PLESK-CHECKOUT/public/assets:/data/brand-assets:ro
```

Set `BRAND_ASSETS_BASE_DIR=/data/brand-assets` in the n8n execution container. The exact left-hand path depends on the Plesk Git checkout configured for this application and must be confirmed on the server.
## Health Check

`GET /health`

Expected response includes `ok: true`.

## Rollback

1. Stop the app.
2. Restore previous Git tag.
3. Restore database backup if migrations were already applied.
4. Restart.
5. Verify `/health` and login.

The Phase 1A migration is additive, but rolling the application back after applying it leaves the new tables and `FileObject` columns in place. Prefer restoring a pre-migration MariaDB backup for a complete rollback. Never remove the private storage directory during a code rollback.

## Branded Image Composition

The n8n custom-image, bind-mount, module allowlist, preflight, and activation procedure is documented in `docs/N8N_SHARP_COMPOSITION.md`.
