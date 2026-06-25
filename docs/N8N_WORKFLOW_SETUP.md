# n8n Workflow Setup

The workflows under `workflows/n8n/generated/` are draft workflow shells pushed through the n8n public API.

## Commands

```bash
npm run n8n:build-workflows
npm run n8n:check-workflows
npm run n8n:push-workflows
npm run n8n:verify-workflows
```

The push and verify scripts load n8n API credentials from the parent project `.env` first:

```text
G:\Other computers\My Computer\Dev_Projects\Future4site\.env
```

This keeps local n8n operator credentials separate from the deployed CP `.env` in `future-foresight-admin/.env`.
If needed, override the env file explicitly:

```bash
N8N_ENV_FILE=/path/to/.env npm run n8n:push-workflows
```

The content workflow signs CP callbacks inside an n8n Code node. The n8n server must allow the built-in Node `crypto` module:

```env
NODE_FUNCTION_ALLOW_BUILTIN=crypto
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
PLATFORM_CALLBACK_SECRET=same_value_as_cp
```

Restart n8n after changing these values.

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
- Creative image generation: `future-foresight/creative-image-generation`
- Creative video generation: `future-foresight/creative-video-generation`
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
N8N_CREATIVE_IMAGE_WEBHOOK_PATH=future-foresight/creative-image-generation
N8N_CREATIVE_VIDEO_WEBHOOK_PATH=future-foresight/creative-video-generation
```

## Credentials To Add In n8n Later

- Platform callback shared secret, represented by an environment variable or n8n credential.
- Text-generation LLM environment variables for the content workflow:
  - `LLM_TOKEN`
  - `LLM_BASE_URL`, optional, defaults to `https://api.openai.com/v1/chat/completions`
  - `LLM_MODEL`, optional, defaults to `gpt-4o-mini`
- Magnific credential for generation workflows.
- Meta credential for Facebook and Instagram publishing.
- SMTP or notification channel credentials if reminder/report workflows send messages.
- Platform API credential if n8n writes back through platform APIs.

If `LLM_TOKEN` is not configured, `FF Admin - Content Request Intake - Draft` still returns a deterministic safe draft with a warning. That keeps the CP-to-n8n-to-CP flow testable while LLM credentials are being prepared or changed.

The content workflow currently performs:

1. Capture and validate the CP request.
2. Respond to CP so the job can enter `WAITING_FOR_CALLBACK`.
3. Build approved evidence and prohibited-claim rules.
4. Generate English B2B text using an OpenAI-compatible LLM when configured.
5. Sanitize output and replace unsafe text with a safe fallback.
6. Sign and send the callback to CP.

Magnific image/video generation remains deferred and disabled.

## Activation Checklist

Before activating any workflow:

- Add signature validation.
- Configure all required credentials inside n8n.
- Confirm callback URL points to the deployed admin platform.
- Run manual test execution.
- Confirm output is stored in the platform.
- Confirm failed paths are visible in Automation Jobs.
- Keep Meta publishing blocked until owner approval and dry-run tests are complete.
