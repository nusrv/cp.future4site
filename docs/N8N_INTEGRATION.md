# n8n Integration

The browser never calls n8n directly.

## Request Flow

1. User creates a request inside the platform.
2. Backend validates and stores it.
3. Backend creates an `AutomationJob`.
4. Backend signs and sends a request to n8n.
5. n8n acknowledges or processes asynchronously.
6. n8n sends signed progress and final callbacks to the platform.
7. Platform stores `AutomationJobEvent` rows and output metadata.

## Signatures

Use HMAC SHA-256 over the canonical JSON request body with `N8N_WEBHOOK_SECRET`.

Headers:

- `x-ff-signature`
- `x-ff-timestamp`
- `x-ff-correlation-id`
- `x-ff-idempotency-key`

## Recovery

Hybrid mode is recommended:

- callbacks for normal operation;
- polling or manual reconcile for missed callbacks;
- failed jobs stay visible and retryable.

