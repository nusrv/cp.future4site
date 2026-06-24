# Meta Integration

Meta publishing is separated from generation and approval.

## Current Platform Capability

- Build publishing UI.
- Store approval and publish commands.
- Create publishing `AutomationJob` records.
- Send dry-run jobs to n8n.
- Store returned platform IDs and URLs when available.

## Blocked For Live Publishing

- Meta app and permissions verification.
- Facebook Page token.
- Instagram Business account access.
- Long-lived token handling.
- Public media hosting.
- End-to-end dry-run and live test approval.

## Safety

No automatic publishing. A user must approve content for publication and then trigger a separate publish action.

