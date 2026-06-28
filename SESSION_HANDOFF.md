# Future Foresight CP - Session Handoff

Canonical restart point after any interrupted or completed session. Read this file first before changing the CP or its n8n workflows.

Last verified: **2026-06-28 (Asia/Amman)**

## Restart checklist

1. Read this file completely.
2. Run `git status --short --branch` and inspect the latest five commits.
3. Run `node scripts/verify-n8n-workflows.mjs` for a read-only live n8n inventory.
4. Separate verified live state from documentation and inference.
5. Do not activate publishing, modify live workflows, migrate data, or expose credentials without owner authorization.

## Current implementation update

Applied on 2026-06-28, pending commit:

- Replaced Marketing Studio with a state-driven Content queue and focused request detail.
- Added automatic 2.5-second refresh only while visible automation jobs are active.
- Added format-specific paths for text, image, video, and carousel requests.
- Media requests stay out of Publishing until a creative asset is received and approved.
- Added creative callback materialization and creative approve/regenerate/reject endpoints.
- Added server-side media, channel compatibility, and dry-run guards before publication.
- Replaced five Publishing buttons with channel selection, publishing check, then one live publish action.
- Applied the approved neutral white/gray UI direction with restrained olive/gold accents and WCAG AA-oriented states.
- Added focused workflow-stage tests.

Verification limitation: `npm ci` succeeded in a local temporary copy, but Node stalled indefinitely reading installed TypeScript and Vitest package files, including `tsc --version`. Typecheck, tests, build, and browser verification could not complete in this environment and must be rerun after the package-file access issue is resolved.
## CP state

- Branch: `develop`, synchronized with `origin/develop` at last check.
- Working tree before this handoff: clean.
- Latest implementation commit: `26d49ae`, 2026-06-25 13:19:16 +03:00 - `Add rejected posts, creative workflow handoff, and user controls`.
- Version `0.1.0`; Fastify, React/Vite, TypeScript, Prisma, MariaDB/MySQL.

Implemented:

- Authentication, cookie sessions, roles, permissions, audit events, and user administration.
- CRM records for leads, inquiries, organizations, contacts, suppliers, customers, tasks, and deals.
- Marketing Studio generation, review, approval, rejection, restore, and archive controls.
- Automation jobs, signed n8n callbacks, failure visibility, and publishing dry-run foundations.

Latest CP update:

- Added the rejected-post area with restore and archive/delete controls.
- Added protected user deletion.
- Publication approval now requests image generation for `text_image`/`carousel` or video generation for `text_video`.
- Added creative image/video webhook configuration.

Not proven: production deployment, protected URL, database/migration state, `/health`, or login. Local dependencies are absent, so tests and build could not run (`vitest` and `tsc` unavailable).

## Live n8n state

Read-only API verification was performed on 2026-06-28. No live workflow was changed.

- Workflow: `FF Admin - Content Request Intake - Draft`
- ID: `JgGTeTGe6CrP85b2`
- Active: **yes**
- Created: `2026-06-24T11:21:56.827Z`
- Last live update: `2026-06-25T09:46:47.361Z` (12:46:47 Asia/Amman)
- Version ID: `eca138d3-2b67-4d29-8740-a4b663ec69c7`
- 10 nodes; live model node: Google Gemini Chat Model.

The active flow validates and acknowledges a CP content request, builds evidence constraints, generates and sanitizes content, then sends an HMAC-signed callback to the CP.

Latest n8n update: the June 25 content-formatting prompt patch added a short hook, readable line breaks, a separate CTA, and hashtags outside the caption. It followed the Node `crypto` callback-signing fix, production generator path, and CP callback materialization.

Inactive workflow shells observed:

- Publication Dry Run
- Facebook/Instagram Publishing - Blocked Draft
- Lead Intake Callback
- Lead Normalization and Routing
- Follow-up Reminders
- Weekly Management Report
- Knowledge Base Index Sync
- Claim Validation
- Magnific Generation
- Platform Callback Helper
- Dead Letter and Health Monitoring

Creative generation is incomplete: CP dispatch code exists, but working image/video webhook endpoints were not proven active, and the generic Magnific workflow was inactive.

Separate LOI workflow from the project record:

- `Future Oils - LOI Form Intake`, ID `aH98nZEuSkX9vhig`.
- Form: `https://wap.nusrv.com/form/future-oils-loi`.
- Data Table: `Future Oils Leads`, ID `ZWsJQSR7RNhzPQ1g`.
- Last documented as active with storage and SMTP working; not independently re-queried in this audit.

## Blockers and next actions

1. Confirm CP deployment, database, migrations, `/health`, and login.
2. Run `npm ci`, tests, typecheck, build, and secret scan.
3. Reconcile the workspace plan, which still says not to build a custom app, with the implemented CP.
4. Implement and test image generation end to end, then video generation.
5. Keep Meta publishing disabled until credentials, permissions, public media hosting, duplicate protection, dry-run acceptance, and owner approval are complete.
6. Rotate any n8n API key exposed during setup. Never record secrets here.
7. Reconcile older OpenAI-compatible generator docs with the live Gemini workflow.

## Mandatory end-of-session protocol

Before ending a session that changes project state:

1. Update the verification date, CP state, n8n state, blockers, and next actions here.
2. Record exact commit hashes and workflow IDs/version timestamps when they change.
3. Distinguish verified facts from documented or inferred state.
4. Record tests/build results or why they could not run.
5. Never record passwords, keys, tokens, connection strings, or private customer data.
6. Commit this handoff update with the implementation it describes.
