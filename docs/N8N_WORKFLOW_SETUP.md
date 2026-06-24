# n8n Workflow Setup

The workflows under `workflows/n8n/generated/` are draft workflow shells pushed through the n8n public API.

## Commands

```bash
npm run n8n:build-workflows
npm run n8n:check-workflows
npm run n8n:push-workflows
npm run n8n:verify-workflows
```

## Safety State

- Workflows are created inactive.
- No credentials are embedded.
- Publishing workflows do not call Meta in dry-run mode.
- Disabled placeholder HTTP nodes must not be connected until credentials and approval gates are complete.

## Platform Webhook Paths

Use these paths in `.env` and n8n:

- `N8N_BASE_URL=https://wap.nusrv.com`
- `N8N_WEBHOOK_BASE_PATH=webhook-test` for n8n test webhooks
- `N8N_WEBHOOK_BASE_PATH=webhook` for active production webhooks
- Content generation: `future-foresight/content-generation`
- Publishing dry-run: `future-foresight/publish-dry-run`
- Lead intake: `future-foresight/lead-intake`
- Lead routing: `future-foresight/lead-routing`
- Knowledge Base sync: `future-foresight/kb-sync`
- Claim validation: `future-foresight/claim-validation`
- Magnific generation: `future-foresight/magnific-generation`

For your current n8n test URL:

```text
https://wap.nusrv.com/webhook-test/future-foresight/content-generation
```

configure:

```env
N8N_BASE_URL=https://wap.nusrv.com
N8N_WEBHOOK_BASE_PATH=webhook-test
N8N_CONTENT_WEBHOOK_PATH=future-foresight/content-generation
```

## Credentials To Add In n8n Later

- Platform callback shared secret, represented by an environment variable or n8n credential.
- Magnific credential for generation workflows.
- Meta credential for Facebook and Instagram publishing.
- SMTP or notification channel credentials if reminder/report workflows send messages.
- Platform API credential if n8n writes back through platform APIs.

## Activation Checklist

Before activating any workflow:

- Add signature validation.
- Configure all required credentials inside n8n.
- Confirm callback URL points to the deployed admin platform.
- Run manual test execution.
- Confirm output is stored in the platform.
- Confirm failed paths are visible in Automation Jobs.
- Keep Meta publishing blocked until owner approval and dry-run tests are complete.
