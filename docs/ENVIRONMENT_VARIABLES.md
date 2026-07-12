# Environment Variables

Use `.env.example` as the contract. Do not commit real `.env` files.

## Required For Local Development

- `DATABASE_URL`
- `SESSION_SECRET`
- `ADMIN_BOOTSTRAP_USERNAME`
- `ADMIN_BOOTSTRAP_PASSWORD`

## Required For n8n Live Integration

- `N8N_BASE_URL`
- `N8N_API_KEY` (CP uses this only to read workflow/execution readiness; never expose its value)
- `N8N_WEBHOOK_SECRET`
- `N8N_CONTENT_WEBHOOK_PATH`
- `N8N_CREATIVE_IMAGE_WEBHOOK_PATH`
- `N8N_CREATIVE_VIDEO_WEBHOOK_PATH`
- `N8N_PUBLISH_WEBHOOK_PATH`

## Required For Production Publishing

- `META_PUBLISHING_ENABLED=true` in CP enables the publishing feature gate. It is not a Facebook credential.
- Facebook Page ID and Page access token are owned by the n8n container or n8n credential system. For Future Oils, the current n8n aliases are `FUTURE_OILS_FACEBOOK_PAGE_ID` and `FUTURE_OILS_FACEBOOK_ACCESS_TOKEN`.
- Never copy Meta tokens, Page credentials, application secrets, or n8n credential values into CP environment variables, API responses, workflow JSON, logs, or database rows.
- CP capability checks use the n8n API to verify the exact workflow and sanitized execution history. They do not inspect n8n credential values.

## Future Read-only Facebook Validation

Phase 2 should add a dedicated n8n validation operation that uses the existing n8n-managed Facebook credentials for a read-only Graph API request. It must not upload media or create a post, and it must return only sanitized readiness state to CP. Token or credential values must never be returned.

## Optional

- SMTP variables for platform email notifications.
- Storage provider variables if local disk is replaced by object storage.
- Magnific references are normally handled by n8n.

