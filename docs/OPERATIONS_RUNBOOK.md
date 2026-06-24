# Operations Runbook

## Daily Checks

- `/health`
- failed automation jobs
- overdue first-touch tasks
- content awaiting review
- audit events for suspicious login attempts

## Incident Handling

1. Disable affected integration mode.
2. Preserve logs and audit events.
3. Mark affected jobs as failed or cancelled.
4. Notify owner.
5. Restore from backup only after cause is understood.

## Release Checklist

- tests pass;
- secret scan passes;
- migrations reviewed;
- docs updated;
- release tag created;
- rollback path known.

