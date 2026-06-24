# Environment Variables

Use `.env.example` as the contract. Do not commit real `.env` files.

## Required For Local Development

- `DATABASE_URL`
- `SESSION_SECRET`
- `ADMIN_BOOTSTRAP_USERNAME`
- `ADMIN_BOOTSTRAP_PASSWORD`

## Required For n8n Live Integration

- `N8N_BASE_URL`
- `N8N_WEBHOOK_SECRET`
- `N8N_CONTENT_WEBHOOK_PATH`
- `N8N_PUBLISH_WEBHOOK_PATH`

## Required For Production Publishing

- `META_APP_ID`
- `META_PAGE_ID`
- `META_IG_USER_ID`
- Meta long-lived token stored in secure secret storage, not normal database rows.

## Optional

- SMTP variables for platform email notifications.
- Storage provider variables if local disk is replaced by object storage.
- Magnific references are normally handled by n8n.

