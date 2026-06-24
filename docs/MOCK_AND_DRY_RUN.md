# Mock And Dry-Run Modes

## Mock

Used for local development without external services. Mock jobs generate synthetic output and never call n8n, Meta, Magnific, SMTP, or other live APIs.

## Dry Run

Used to validate request contracts and publishing logic without live publication.

Publishing dry-run must not call Meta endpoints.

## Live

Live mode requires configured credentials, owner approval, and tested rollback.

