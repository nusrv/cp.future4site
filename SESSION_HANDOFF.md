# Future Foresight CP - Session Handoff

Canonical restart point after any interrupted or completed session. Read this file first before changing the CP or its n8n workflows.

Last verified: **2026-06-29 (Asia/Amman)**
## Latest creative image workflow update

Built, statically validated, cryptographically contract-tested, and deployed **inactive** to live n8n on 2026-06-29:

Implementation checkpoint: `ccda7ec` - `Build creative image generation workflows`.

- `FF Admin - Creative Image Generation`, ID `rWQZP7saIkXUXDUD`, webhook `future-foresight/creative-image-generation`.
- `FF Admin - Creative Image Result Callback`, ID `sytKGJk2xuA2gtEz`, webhook `future-foresight/creative-image-result`.
- Replaced the obsolete generic `Magnific Generation` placeholder.
- Intake verifies the CP HMAC, acknowledges promptly, submits a branded 4:5 Mystic request with an approved Future Oils product reference, and carries CP callback context into the result webhook.
- Result handling verifies the Magnific webhook HMAC, maps completed image URLs to CP creative files, and sends an HMAC-signed callback to the CP.
- CP callback materialization/review/publishing code already exists: a successful callback creates a `CreativeAsset`; approved media content becomes eligible for Publishing only after creative approval.

Verified commands:

- `node scripts/check-n8n-workflows.mjs` � passed.
- `node scripts/check-creative-image-workflows.mjs` � passed (7 intake nodes, 4 result nodes).
- `node scripts/test-creative-image-workflow-contract.mjs` � passed CP request HMAC, Magnific result HMAC, CP callback HMAC, image mapping, and invalid-signature rejection.
- Both workflow definitions were accepted by the live n8n API while inactive.

Live activation and a real image generation remain blocked until the n8n service has `MAGNIFIC_TOKEN`, `MAGNIFIC_WEBHOOK_SECRET`, and the same `N8N_WEBHOOK_SECRET` used by deployed CP, followed by an n8n restart. `PLATFORM_CALLBACK_SECRET` must continue matching CP; the working text callback indicates it is likely already configured, but this has not been independently read back. Never put secret values in this file or chat.

The production CP build was attempted but could not start because dependencies were absent. Two `npm ci` attempts in this synced-drive workspace stalled without creating `node_modules/.bin/tsc.cmd`; the second was terminated after several silent minutes. Workflow-specific checks do not depend on that install and passed.

## Restart checklist

1. Read this file completely.
2. Run `git status --short --branch` and inspect the latest five commits.
3. Run `node scripts/verify-n8n-workflows.mjs` for a read-only live n8n inventory.
4. Separate verified live state from documentation and inference.
5. Do not activate publishing, modify live workflows, migrate data, or expose credentials without owner authorization.

## Current implementation update

Applied and pushed on 2026-06-28/29:

- `2e8421d` - `Polish CP content and publishing workflow`.
- `ee83f67` - `Fix creative asset metadata lookup typecheck`.

- Replaced Marketing Studio with a state-driven Content queue and focused request detail.
- Added automatic 2.5-second refresh only while visible automation jobs are active.
- Added format-specific paths for text, image, video, and carousel requests.
- Media requests stay out of Publishing until a creative asset is received and approved.
- Added creative callback materialization and creative approve/regenerate/reject endpoints.
- Added server-side media, channel compatibility, and dry-run guards before publication.
- Replaced five Publishing buttons with channel selection, publishing check, then one live publish action.
- Applied the approved neutral white/gray UI direction with restrained olive/gold accents and WCAG AA-oriented states.
- Added focused workflow-stage tests.

The Prisma metadata lookup now uses MySQL JSONPath syntax: `path: "$.automationJobId"`. The previous array syntax was incompatible with this repository's MySQL connector and blocked the build/typecheck path. The fix is committed and synchronized with `origin/develop`. A complete build/test/browser result after that fix has not been independently verified in this session.
## CP state

- Branch: `develop`, synchronized with `origin/develop` at last check.
- Working tree before this handoff: clean.
- Latest implementation commit: `ee83f67` - `Fix creative asset metadata lookup typecheck`.
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

Not proven: production deployment, protected URL, database/migration state, `/health`, login, and the complete post-fix test/build/browser verification result.

## Live n8n state

The content workflow state below was read-only verified on 2026-06-28. On 2026-06-29, the two creative image workflows listed above were deployed inactive; no active workflow was changed.

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

Creative image workflow definitions are now deployed inactive and contract-tested. Real Magnific generation, signed live callback delivery, CP asset creation, creative review, and Publishing transition still require credential installation, activation, and one live CP request. Creative video generation remains unimplemented.

Separate LOI workflow from the project record:

- `Future Oils - LOI Form Intake`, ID `aH98nZEuSkX9vhig`.
- Form: `https://wap.nusrv.com/form/future-oils-loi`.
- Data Table: `Future Oils Leads`, ID `ZWsJQSR7RNhzPQ1g`.
- Last documented as active with storage and SMTP working; not independently re-queried in this audit.

## Blockers and next actions

1. Confirm CP deployment, database, migrations, `/health`, and login.
2. Run `npm ci`, tests, typecheck, build, and secret scan.
3. Reconcile the workspace plan, which still says not to build a custom app, with the implemented CP.
4. Configure the three required n8n creative-image secrets, restart n8n, activate both creative image workflows with `npm run n8n:deploy-creative-image -- --activate --confirm-live`, and execute one live CP image request through approval and Publishing; then implement video generation.
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
