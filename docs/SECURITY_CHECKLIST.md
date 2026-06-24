# Security Checklist

- No public registration.
- Passwords hashed with Argon2id.
- HTTP-only secure cookies in production.
- CSRF protection for unsafe methods.
- Rate limit login and API requests.
- Role-based authorization.
- Supplier profile restrictions.
- PII access restrictions.
- Audit user actions.
- Sign n8n callbacks.
- Redact secrets from logs and UI.
- Store secrets only in environment or platform secret manager.
- Rotate exposed n8n API key before live operations.
- Review existing public website client-side SMTP configuration separately.
- Back up before migrations.
- Run `npm run secret:scan`.

