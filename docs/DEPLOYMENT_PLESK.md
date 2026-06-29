# Plesk Deployment

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


## Media Storage

Before starting the application, create a persistent private directory that is not replaced by Git pulls or deployment builds:

```bash
mkdir -p /var/www/vhosts/YOUR-DOMAIN/private/cp-storage/images
```

Configure production `.env`:

```env
FILE_STORAGE_DRIVER=local
FILE_STORAGE_PATH=/var/www/vhosts/YOUR-DOMAIN/private/cp-storage
MAX_UPLOAD_MB=25
```

Grant the Plesk application user read and write permission to the directory. Uploaded images are private and are served only through authenticated CP routes.

## Health Check

`GET /health`

Expected response includes `ok: true`.

## Rollback

1. Stop the app.
2. Restore previous Git tag.
3. Restore database backup if migrations were already applied.
4. Restart.
5. Verify `/health` and login.
