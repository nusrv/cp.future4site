# Plesk Deployment

## Phase 1B deployment gate

Before deploying migration 202607130002_human_review_approved_claims:

1. Back up MariaDB and the complete private file-storage root.
2. Verify existing KnowledgeDocument, KnowledgeDocumentVersion, FileObject, Document, and KnowledgeIndex row counts.
3. Run Prisma migration deployment and regenerate Prisma Client before starting the application.
4. Build and test the release, then restart the Passenger application.
5. Confirm an existing Phase 1A document still lists, downloads, versions, archives, and restores.
6. Verify one source review through approval, a rejected replacement that leaves the prior approved version intact, independent English/Arabic wording approval, final claim approval, and read-only role behavior.

The migration is additive but has no automatic down migration. Application rollback can revert the release while leaving additive tables unused. Full database rollback requires the pre-deployment MariaDB backup. Do not drop claim or review tables after operators have created audit history.

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
