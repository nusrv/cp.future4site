# Future Foresight CP - Session Handoff

## 2026-07-15 knowledge platform Phases 2A through 5 gate

Owner-reported baseline: Phase 1B production acceptance and the Phase 1C manual pilot are complete and working. This workspace did not independently query production.

Implemented on `develop` after `cea6a12`:

- `f240506` adds disabled deterministic TXT/CSV/PDF extraction, immutable version fragments, permissioned APIs, CP controls, audit events, limits, migration, and contracts.
- `747ae5f` adds disabled explicit bilingual OCR with Tesseract/Poppler adapters, page confidence, resource/concurrency limits, source comparison, migration, and contracts.
- `2beae71` adds separately stored Gemini candidate runs/proposals, strict source-ID provenance, explicit reject or draft acceptance, provider/data-approval gates, migration, CP review UI, and contracts.
- `2b2d677` adds the read-only exact approved-claim resolver, all applicability dimensions, locale/date/supersession handling, safe provenance, diagnostics, audit, and contracts.
- `39850db` adds disabled evidence-backed generation, explicit content locale, immutable evidence snapshots, signed n8n payload evidence, callback claim-ID validation, CP evidence display, migration, and contracts.
- `8d31b9f` records the Phase 5 decision to defer embeddings/vector search until a 100-judgment bilingual evaluation gate demonstrates material vocabulary-driven false negatives.

Safety boundaries:

- CP/MariaDB remain authoritative. Original files remain private and immutable. n8n has no database access.
- Extraction and OCR text are internal source proposals, never approved claims.
- Gemini output is an unapproved candidate. Accepting requires operator-confirmed wording, scope, dates, and applicability and creates only a normal DRAFT.
- The resolver reads only APPROVED, PUBLIC_SAFE, effective, unexpired claim revisions with independently approved locale wording and approved immutable provenance.
- Exact product, packaging, brand, market, audience, objective, and locale restrictions never broaden.
- Evidence-backed generation is off by default, snapshots exact claim revisions before dispatch, requires returned claim-ID citations, and retains all existing human content/creative/publishing approvals.
- `KnowledgeIndex` remains unchanged and unused. Semantic retrieval, embeddings, and a vector database were not added.

New migrations, in order:

1. `202607150001_deterministic_knowledge_extraction`
2. `202607150002_knowledge_ocr`
3. `202607150003_knowledge_candidate_claims`
4. `202607150004_generation_evidence_bundles`

All are additive. The fourth adds `ContentRequest.locale` with default `en`; no existing column or table is removed or renamed. None of these migrations was executed against MariaDB in this workspace.

Workspace validation:

- Client TypeScript `--noEmit`: passed.
- Server TypeScript `--noEmit`: passed.
- Secret scan: passed after every phase.
- `git diff --check`: passed after every phase.
- n8n workflow program syntax: passed.
- New MariaDB index/constraint names: longest 26 characters, below the 64-character limit.
- Focused scans found no storage/path exposure and no unauthorized cross-phase coupling.
- The general n8n checker remains blocked by its existing secret-name heuristic on `13-facebook-publishing.json` environment-variable fields; no Facebook workflow or credential was changed.
- Vitest, Prisma validation/generation, production build, and MariaDB execution were not run. Vitest and Prisma CLI are absent from this Google Drive workspace; these remain Plesk gates.

Deployment and rollback are documented in `docs/DEPLOYMENT_PLESK.md`. Keep every new flag false for migration and baseline regression, then enable and accept one phase at a time. Provider credentials and data-handling approval can be added later.

Known limitations:

- Extraction, OCR, and candidate provider calls execute within authenticated HTTP requests rather than a separate durable worker queue.
- Poppler/Tesseract availability and Arabic/English accuracy are unverified until Plesk.
- Gemini retention, residency, cost policy, credentials, and live output quality are unapproved and disabled.
- The content request does not yet select a packaging format, so packaging-restricted claims correctly do not match generation.
- Production `KnowledgeIndex` contents are still not inventoried.
- Semantic retrieval is deferred pending the documented evaluation threshold.

Canonical restart point after any interrupted or completed session. Read this file first before changing the CP or its n8n workflows.

Last verified: **2026-07-13 (Asia/Amman)**

## 2026-07-13 next-phase planning checkpoint

Current source checkpoint: develop is synchronized with origin/develop through 3f6b89a (correct CP identity assets). Phase 1B implementation and its three reported Plesk test corrections are pushed. The corrected full suite has not yet been reported as rerun on Plesk, the Phase 1B migrations have not been reported as applied, and the Phase 1B application build has not been reported as deployed.

## 2026-07-15 knowledge-platform continuation

The owner reports that Phase 1B production acceptance and the Phase 1C small manual pilot are complete and working. This is owner-reported operational evidence; this workspace did not query production or rerun those checks.

Phase 2A deterministic extraction is in development. It is CP-owned, disabled by default, version-bound, audited, and isolated from approved claims and content generation. TXT/CSV extraction is built in; PDF extraction uses a configured Poppler executable without a shell. No OCR, AI candidate generation, resolver, prompt, n8n, or publishing integration is part of Phase 2A.

Previous Phase 1B acceptance instructions below are retained as historical deployment guidance:

Immediate next action was Phase 1B production acceptance:

1. Pull current develop on Plesk and take verified MariaDB plus FILE_STORAGE_PATH backups.
2. Rerun the complete deployment validation gate, including the full test suite.
3. Apply and verify both additive Phase 1B migrations only after all pre-migration gates pass.
4. Restart CP and run source-review, claim, locale, supersession, permission, Phase 1A regression, and final branding smoke tests.
5. Record the deployed commit, migration state, test totals, smoke-test evidence, and rollback checkpoint in this handoff.
6. Inspect production KnowledgeIndex contents without changing them.

The planning-only roadmap for governance, extraction, OCR, AI-assisted candidate claims, the approved-claim resolver, controlled generation integration, and optional semantic retrieval is in docs/KNOWLEDGE_ROADMAP.md. No Phase 2 implementation is authorized by that document. Recommended next phase after production acceptance is Phase 1C: a small manually curated pilot that proves governance and data quality before automation.

## 2026-07-13 CP identity fix

The login and authenticated sidebar now replace the FF text mark with main-logo.png from the Future4site Website identity, aligned left with Internal management directly below it. The favicon is a square, transparently padded crop containing only the colored bird from that source; the black wordmark text is excluded so browser icon masks remain legible. Placement and outer sizing remain unchanged.

## 2026-07-13 Phase 1B Plesk test-gate correction

The first Plesk Phase 1B test run passed 85 of 88 tests. This focused correction addresses only the three reported failures:

- The Knowledge Library contract now asserts the intentional replacement policy: an APPROVED_SOURCE predecessor remains APPROVED_SOURCE, while other predecessor states become SUPERSEDED.
- The locale contract now verifies use of the claimId_locale compound unique key and the input locale without depending on a local variable name.
- isWithinStorageRoot now selects Windows or POSIX path semantics from the supplied absolute root, independent of the host running the test. It fails closed for relative or mixed-format inputs and rejects sibling prefixes, normalized traversal, different Windows drives, and the storage root itself.
- Plesk POSIX containment cases remain explicit, and Windows containment remains covered on Linux.

Dependency-free validation in the Google Drive workspace passed for the extracted helper body across nine Windows/POSIX cases, the secret scan, and git diff whitespace checks. This workspace has no Vitest binary, so the full suite was not rerun locally. Plesk must rerun npm test before deployment. No migration, schema, production data, publishing, n8n, or AI behavior changed.

## 2026-07-13 Phase 1B implementation complete, deployment gated

Phase 1B human source review and manually approved claims is complete in source on develop. It has been statically reviewed only and has not been deployed.

Phase 1B commit series after baseline 41c0f46:

- 5460b21 - Add human review and approved claims.
- aae1d06 - Record Phase 1B deployment gates.
- c1f0f28 - Harden claim revision supersession.
- 3e17f84 - Complete claim revision workspace.
- 47571d5 - Add claim revision contracts.
- ae8bb9c - Document Phase 1B deployment gate.
- 5cd08df - Lock protected claim revision fields.
- The following handoff commit records final static validation and deployment gates.

Final behavior:

- Source versions use explicit submit, begin, approve, reject, and audit-safe return transitions. Archived documents and security-rejected files cannot begin review. Replacement uploads are never auto-approved and do not invalidate an earlier approved source.
- Claim rows are immutable revisions under a stable claim key. The history API returns deterministic descending revision order and identifies the latest and current approved revisions.
- Creating a replacement draft leaves the current approved revision unchanged. Final replacement approval locks the conceptual revision set, rejects stale/conflicting attempts, approves the replacement, and marks exactly its current approved predecessor SUPERSEDED in one transaction with separate audit events.
- Rejected claims are immutable. A latest rejected revision creates a new draft; if the conceptual claim never had an approval, that new draft can become its first approved revision without rewriting history.
- Generic claim PATCH changes only editable draft metadata, provenance, and applicability. It cannot set lifecycle, actor, approval, revision, or supersession fields. Generic translation PATCH changes only DRAFT wording and cannot reset review/approval metadata.
- Arabic and English wording have independent review states. Reviewed wording is locked; corrections require a new claim revision.
- Final approval requires at least one APPROVED_SOURCE version, independently approved required locales, explicit usage scope, and explicit applicability.
- OWNER_ADMIN has an explicit self-approval override. Non-owner creators or last editors cannot approve their own wording or claim. MARKETING is draft-only, CONTENT_REVIEWER reviews/approves, READ_ONLY_MANAGEMENT reads, and unauthorized roles have no access.
- The Knowledge Library UI provides grouped conceptual claims, full revision history, historical read-only views, actors/timestamps, locale states, applicability, provenance, source navigation, audit activity, inline supersession confirmation, permission-aware controls, safe API errors, and a mobile layout.
- KnowledgeIndex, generation, prompts, Gemini, n8n, OCR, extraction, embeddings, semantic search, resolver behavior, publishing, and existing product resolution remain unchanged.

Migration review:

- 202607130002_human_review_approved_claims remains the original additive migration.
- 202607130003_claim_supersession_guard is a separate additive correction with a nullable approved-predecessor relation, index, and foreign key.
- Static SQL review found no table/column drops, deletes, truncation, or changes to Document, KnowledgeIndex, or FileObject. Fifty-four explicit index/constraint names were parsed; the longest is 37 characters, below MariaDB's 64-character limit.
- Existing Phase 1A document/version/file relations remain structurally compatible. Production row contents and KnowledgeIndex contents were not queried.
- Neither migration has been executed against MariaDB.

Static validation completed without dependency installation:

- Dependency-free secret scan passed.
- Working-tree and complete 41c0f46..HEAD patch whitespace checks passed.
- Focused runtime scan found no AI, Gemini, n8n, OCR, extraction, embedding, semantic-search, publishing, content-request, or automation-job coupling in the new claim domain.
- Focused response/UI scan found no storage key, filesystem path, absolute path, or FILE_STORAGE_PATH exposure in the claim domain.
- Changed-file review found only Phase 1B schema/migrations, knowledge routes/shared policy/permissions, Knowledge Library UI/API/styles, focused tests, and documentation/handoff changes.

Per owner direction, npm dependency installation, Prisma Client generation, Prisma validation execution, Vitest, TypeScript compilation, production build, and MariaDB migration execution were not run in the Google Drive workspace. Tests were authored and statically reviewed but not executed.

Deferred Plesk gates, in order:

```text
npm run db:generate
npx prisma validate
npm test
npm run typecheck
npm run build
npm run db:migrate
```

Before db:migrate, take restorable MariaDB and complete private FILE_STORAGE_PATH backups. After migration, verify both migration records, new indexes/foreign keys, legacy row counts, restart Passenger, then complete source-review, claim creation/revision, independent translation, transactional supersession, role-permission, and Phase 1A regression smoke tests. The exact procedure and rollback choices are in docs/DEPLOYMENT_PLESK.md.

Workspace note: this checkout is on Google Drive and its Windows sandbox ACL refresh is unreliable. Changes were made with the repository patch mechanism through explicitly approved direct access. No local-HDD copy was used.

## 2026-07-13 Phase 1A private Knowledge Library foundation

Implemented on `develop` from baseline `33925ab` in a clean non-Google-Drive checkout:

- `bba4794` adds the additive MariaDB/Prisma models, enums, indexes, and migration for `KnowledgeDocument`, immutable `KnowledgeDocumentVersion`, and `FileObject.securityStatus`.
- `a3a67ec` adds the controlled `knowledge-base` namespace, opaque storage layout, path containment, extension/MIME/content verification, SHA-256 handling, and `SCAN_UNAVAILABLE` fallback.
- `91327b6` adds permission-enforced private document/version/list/download/archive/restore APIs and audit events.
- `0cd47df` adds the permission-aware Knowledge Library list, filters, upload, details, metadata edit, replacement, version timeline, scan state, private download, and in-app archive/restore UI.
- `8ea5061` adds focused storage, permission, API-contract, version, archive, audit, and UI coverage.
- `cb9ee14` documents private storage, Plesk deployment, backup/restore, security state, and the Phase 1A boundary.
- `1cb3dfb` makes the Fastify cookie type augmentation explicit and keeps the new contract test type-safe.

Phase boundary preserved: no extraction, OCR, claims, approval/rejection workflow, embeddings, Gemini, n8n, permanent deletion, antivirus installation, or publishing changes.

Validation:

- `npm ci` passed; npm reported 10 pre-existing audit findings (3 moderate, 6 high, 1 critical), not changed in this phase.
- Prisma schema validation and client generation passed.
- Full Vitest: 14 files, 67 tests passed.
- Client TypeScript, server TypeScript, and production Vite/server build passed.
- Secret scan and `git diff --check` passed.
- A clean MariaDB migration execution could not run locally: Docker is unavailable and the installed local MySQL service requires credentials not available to this workspace. Production deployment must take a database backup and run `npm run db:migrate` as a deployment gate before starting the new build.

Deployment required:

1. Back up MariaDB and the full existing `FILE_STORAGE_PATH`.
2. Confirm an absolute private storage root outside `httpdocs`, for example `/var/www/vhosts/future4site.com/private/cp-storage`.
3. Create its `knowledge-base` directory and grant the effective Passenger application user read/write access without public web access.
4. Pull `develop`, run `npm ci`, `npm run db:migrate`, `npm test`, and `npm run build`, then restart CP.
5. Verify login, Knowledge Library permissions, one safe upload/download/archive/restore cycle, and coordinated database/file backup coverage.

Phase 1B recommendation: add a separate human review/approval domain and source-to-approved-claim workflow before any extraction or AI resolver is connected.

## 2026-07-13 Facebook hashtag and duplicate-CTA correction

Directly verified from live n8n:

- Active workflow FF Admin - Facebook Publishing (ID 9DSImxhIAF5PENgg).
- Successful live execution 18348 received a caption that already ended with Request a Quote, then appended the separate CTA again.
- The matching content-generation execution 18345 generated and returned eight hashtags in its signed callback.
- CP omitted item.hashtags from the Facebook publishing job payload, so execution 18348 received no hashtags.

Implemented:

- CP now includes item.hashtags in the publishing payload.
- Prepare Facebook Photo Uploads adds the CTA only when the caption does not already end with the same CTA.
- Hashtags are normalized from string or array input, deduplicated case-insensitively, and appended as the final paragraph.
- The same message composer is used by single-photo and multi-photo Facebook publication paths.
- Added tests/facebook-publishing-workflow.test.ts with CP payload, CTA-deduplication, hashtag-deduplication, and array-input coverage.

Live n8n deployment:

- Pre-change backup: workflows/n8n/exports/2026-07-13T08-28-17-635Z-ff-admin-facebook-publishing.json.
- Workflow updated and kept active at 2026-07-13T08:40:49.646Z.
- Post-deployment export: workflows/n8n/exports/2026-07-13T08-40-56-077Z-ff-admin-facebook-publishing.json.
- The re-exported live Prepare Facebook Photo Uploads code exactly matched the generated workflow.
- No external Facebook post was created during deployment or testing.

Validation:

- Focused Facebook/capability tests: 16 passed.
- Full Vitest suite: 11 files, 47 tests passed.
- Production build passed.

CP deployment required: pull the implementation commit from develop, run npm run build, and restart CP. No migration or environment-variable change is required.

## 2026-07-12 Phase 0.1 n8n-owned Facebook credential alignment

Implemented in `b74f60e` (`Align publishing readiness with n8n credentials`):

- Capability responses now state `credentialManagement: "n8n"`; CP never reads, stores, or returns Facebook access tokens, Page credentials, application secrets, or n8n credential values.
- Facebook availability is gated by CP live integration configuration plus the exact active `FF Admin - Facebook Publishing` workflow. Retained execution history is evidence only and no longer a permanent availability gate.
- Execution evidence is reported as `recent_success`, `previous_failure`, `not_yet_verified`, or `unknown`, with safe last-execution timestamps/status, reason, and warning fields.
- Clearing n8n execution history no longer disables an otherwise configured active Facebook integration.
- A previous failure reports degraded evidence while leaving the configured active workflow available.
- Removed obsolete CP-side Meta secret placeholders from `.env.example`; the documented Future Oils Page ID/token aliases remain n8n-container settings only.
- Documented Phase 2 boundary: a dedicated n8n-owned, non-publishing Graph API validation operation must perform any future current-credential validation and return sanitized state only.

Test baseline repair in `6e4afaf` (`Refresh fixed-template test baselines`):

- Updated the Sharp composition test for the current local fixed-template JPEG workflow, which intentionally does not use `http`, `https`, or `fetch`.
- Updated the public asset approval test to reflect the previously approved 3L product.

Clean temporary checkout validation:

- `npm ci` passed (482 packages). npm reported 10 dependency audit findings: 3 moderate, 6 high, 1 critical; remediation was not attempted in this scoped phase.
- Full Vitest suite passed: 10 files, 43 tests. `tests/publishing-capabilities.test.ts`: 13 passed.
- `npm run build` passed, including client/server TypeScript and Vite production build.
- Secret scan passed.
- `git diff --check` passed.

Production verification status:

- `GET /health` returned HTTP 200 with application/database `ok`, local storage, live integration, n8n configured, and Meta publishing enabled.
- Production still served pre-Phase-0 bundle `/assets/index-JYuT_7LC.js`; it did not contain `/api/content/publishing-capabilities` or the Instagram-disabled reason. Therefore neither `38e0750` nor the Phase 0.1 alignment was deployed at verification time.
- This session had no configured Plesk SSH/API credential or authenticated CP publisher session. Production pull/build/restart, authenticated capability response, 409 persistence checks, and a fresh Facebook dry-run remain externally blocked.
- Last directly verified Facebook evidence remains n8n dry-run execution `18341` and live multi-photo execution `18342`, both successful through signed CP callback on 2026-07-09. No external post was created during Phase 0.1.

Deployment required: pull latest `develop` on Plesk, run `npm ci`, `npm test`, and `npm run build`, restart CP, then perform the authenticated verification checklist. Confirm only that `N8N_API_KEY` exists and works; never print its value. No migration, n8n workflow change, or credential change is required.

## 2026-07-12 Phase 0 Instagram publishing safety correction

Implemented in `ce575be` (`Guard publishing with server capabilities`):

- Added authenticated `GET /api/content/publishing-capabilities` as the server-owned publishing capability contract.
- Facebook is available only when live/Meta publishing is enabled, the CP-to-n8n API/webhook configuration is present, the exact `FF Admin - Facebook Publishing` workflow exists and is active, and n8n reports a prior successful execution as non-secret credential-readiness evidence.
- The endpoint returns capability booleans, supported content types, and safe reasons only. It does not return API keys, access tokens, secrets, signed URLs, or webhook paths.
- Instagram is always reported unavailable with reason `Instagram publishing is not configured yet.` until a dedicated server-supported workflow is implemented.
- The Publishing UI now reads server capabilities, removes the hardcoded `const facebookAllowed = true`, disables Instagram, and displays the server-provided reason.
- Any direct or mixed Instagram publish request is rejected with HTTP 409 and code `PUBLISHING_CAPABILITY_UNAVAILABLE` immediately after request validation, before content lookup, publishing-record creation, automation-job creation, or n8n dispatch.
- Existing Facebook job creation, webhook selection, dispatch, dry-run, and live publishing paths were not changed.

Validation:

- Client TypeScript passed.
- Server TypeScript passed.
- Focused publishing capability behavioral contract passed.
- Focused route-order and UI source contract passed.
- Secret scan passed.
- `git diff --check` passed.
- Added `tests/publishing-capabilities.test.ts`. The local Vitest executable is absent in this synced workspace, so the Vitest suite was not run here and must run in CI/Plesk or a clean dependency checkout.

Deployment required: pull `develop`, rebuild, and restart CP. No database migration, n8n workflow deployment, credential change, or new environment variable is required. CP production must already have its existing `N8N_API_KEY`; if absent, Facebook is safely reported unavailable because workflow activation cannot be verified.

## 2026-07-09 selectable image background templates and non-oil fallback fix

Current image-generation status:

- CP New Content Request now has an `Image background` dropdown populated from `GET /api/content/creative-options`.
- Added `ContentRequest.creativeTemplateId` with migration `202607090001_content_creative_template`.
- CP stores `creativeTemplateId` and sends it to n8n as `payload.template_background_id` during creative image generation.
- `public/assets/brand-profile.json` now has `template_backgrounds.future-oils-classic`, backed by `logo/background.png`.
- n8n `Resolve Brand Assets` now resolves `template_background_id`/`background_id` through `profile.template_backgrounds` and exposes `asset_contract.template_background_id` plus `template_background_path` to Sharp composition.
- Fixed the wrong-oil fallback: approved products no longer score as a match by approval alone, and CP only sends explicit `sunflower-oil-*` product asset IDs when the request text mentions sunflower/oil.
- Removed the New Content Request defaults that forced `Business line = Edible Oils` and `Product = Refined Sunflower Oil`.
- Live n8n workflow backup before deploy: `workflows/n8n/exports/2026-07-09T14-17-39-681Z-ff-admin-creative-image-generation.json`.
- Redeployed and activated live n8n workflow `FF Admin - Creative Image Generation` (`rWQZP7saIkXUXDUD`) at `2026-07-09T14:18:04.178Z`.

Important limitation:

- The repo currently contains only Future Oils sunflower product assets and one Future Oils background template. Sugar, steel, or other product lines need real product PNGs and `brand-profile.json` entries before image generation can produce correct branded images. The fix prevents silent fallback to 1L oil; it does not invent missing non-oil assets.

Validation passed: creative workflow build/check, TypeScript, secret scan, diff check, and brand-profile JSON parse. The older `scripts/test-creative-image-workflow-contract.mjs` is currently stale because it expects `workflows/n8n/generated/13-creative-image-result-callback.json`, which this workflow build no longer generates.

Deployment required for CP: pull latest `develop`, apply Prisma migration, rebuild/restart CP. n8n creative image workflow is already deployed live.
## 2026-07-09 Facebook publishing success and CP cleanup controls

User confirmed Facebook publishing worked after correcting the duplicated CP publish workflow path (`future-foresight/future-foresight/facebook-publishing` -> `future-foresight/facebook-publishing`).

Added CP cleanup/control improvements:

- Publishing page now shows all publishing records for each ready content item, including dry-run/live status and stored error messages.
- Operators can remove an individual publishing record from CP.
- Operators can clear all publishing records for a content item from CP.
- UI warnings explicitly state that removing CP publishing records does not delete posts already published on Facebook/Instagram.
- Added backend endpoints:
  - `DELETE /api/content/publishing-records/:id`
  - `DELETE /api/content/items/:id/publishing-records`
  - `DELETE /api/automation/jobs/:id` (`automation.manage`)
  - `DELETE /api/automation/jobs?status=...&jobType=...&terminalOnly=true` (`automation.manage`)
- Automation job deletion detaches linked publishing records first, then deletes job/events by cascade.
- Bulk automation cleanup defaults to terminal jobs only: `COMPLETED`, `COMPLETED_WITH_WARNINGS`, `FAILED`, `CANCELLED`, `ARCHIVED`.
- Validation passed: TypeScript, secret scan, and diff check.

Deployment required: pull latest `develop`, rebuild/restart CP. No n8n workflow change is required for these cleanup controls.
## 2026-07-09 Facebook publishing dispatch-error surfacing

After the signed-URL fix was deployed, the user still saw a Cloudflare 502 on `POST /api/content/items/:id/publish`. Live n8n check showed workflow `9DSImxhIAF5PENgg` was active but still had zero executions, confirming the request still did not reach n8n.

Additional CP hardening:
- CP publish route now catches `dispatchJob(job.id)` errors per platform instead of letting them surface as a generic 502.
- If CP cannot submit the job to n8n, it creates/updates the `PublishingRecord` with `status: FAILED` and stores the exact dispatch error in `errors.message`.
- This should make the next CP test return a normal JSON response and expose the real CP -> n8n failure in CP data/logs.

Validation passed: TypeScript, secret scan, and diff check.

Required deployment: pull latest `develop`, rebuild/restart CP, then retry Publishing check and inspect the failed publishing record / automation job error if n8n executions are still zero.
## 2026-07-09 Facebook publishing 502 fix

Fixed the first CP Publishing test failure where `/api/content/items/:id/publish` returned 502 and live n8n showed zero executions.

Diagnosis:
- n8n workflow `FF Admin - Facebook Publishing` was active with the correct path, but had zero executions.
- The likely failure point was CP -> n8n webhook submission before n8n execution creation.
- Root cause risk: CP was sending approved images as base64 in `payload.media_files[]`, making the webhook body too large for the CP/n8n proxy path.

Fix implemented:
- CP no longer sends base64 image bytes in the publish webhook payload.
- Added signed expiring media endpoint: `GET /api/automation/publishing-assets/:assetId/file`.
- CP publish payload now sends small `download_url` values in `payload.media_files[]`.
- The signed URL is tied to the publish job ID and creative asset ID, expires after 10 minutes, and requires `PLATFORM_CALLBACK_SECRET` HMAC validation.
- The endpoint verifies the job is a publish job, the creative asset is approved, has a file, and is included in that publishing job payload.
- Updated `FF Admin - Facebook Publishing` so the Facebook `/photos` upload uses the signed media URL field instead of binary/base64 upload.
- Redeployed and activated live n8n workflow `9DSImxhIAF5PENgg`; live `updatedAt`: `2026-07-09T12:58:18.481Z`.

Validation passed locally:
- Facebook workflow JSON parse.
- Build/deploy script syntax checks.
- Secret scan.
- TypeScript check.
- `rg` confirmed Facebook publishing now uses `download_url` / `media_download_url`; remaining `data_base64` references are only for creative-image callback handling.

Required deployment now:
1. Pull latest `develop` on Plesk.
2. Rebuild/restart CP.
3. Retest CP Publishing check, then live Facebook publish.
## 2026-07-09 Facebook publishing preparation

Prepared the first real Facebook publishing path for CP + n8n testing.

- Added generated workflow `workflows/n8n/generated/13-facebook-publishing.json` named `FF Admin - Facebook Publishing`.
- Added builder script `scripts/build-facebook-publishing-workflow.mjs`; `n8n:build-workflows` now regenerates it.
- Added safe single-workflow deploy script `scripts/deploy-facebook-publishing-workflow.mjs`; use this instead of the generic push-all script for this workflow.
- Deployed the workflow to live n8n as inactive. Live workflow ID: `9DSImxhIAF5PENgg`; live `updatedAt`: `2026-07-09T12:35:40.906Z`.
- Workflow webhook path: `future-foresight/facebook-publishing`.
- CP default `N8N_PUBLISH_WEBHOOK_PATH` now points to `future-foresight/facebook-publishing`.
- CP publish payload now includes ordered approved media bytes in `payload.media_files[]`, so n8n can upload binaries directly to Facebook without exposing private media URLs.
- CP publishing callback handling now updates `PublishingRecord` for `publish_*` jobs: dry-run callbacks remain `DRY_RUN`; successful live callbacks become `PUBLISHED`; failed callbacks become `FAILED`.
- Live publish records now use mode `LIVE` instead of `MOCK`.
- Facebook workflow behavior:
  - validates signed CP request using `N8N_WEBHOOK_SECRET`;
  - acknowledges CP immediately;
  - dry-run sends a signed callback and does not call Meta;
  - one image publishes via `/{page-id}/photos` with `published=true`;
  - multiple images upload unpublished photos and create one `/feed` post with `attached_media`;
  - final callback is signed with `PLATFORM_CALLBACK_SECRET`.
- Required n8n Docker env before activation: `META_GRAPH_API_VERSION`, `FUTURE_OILS_FACEBOOK_PAGE_ID`, and `FUTURE_OILS_FACEBOOK_ACCESS_TOKEN`.
- Activation command after n8n env is configured/restarted: `node scripts/deploy-facebook-publishing-workflow.mjs --activate --confirm-live --confirm-facebook-env`.
- Validation passed locally: Facebook workflow JSON parse, build script syntax, deploy script syntax, secret scan, TypeScript check, and diff check.

Pending test:
1. Add/restart n8n Docker env for the Future Oils Facebook credentials.
2. Activate workflow `9DSImxhIAF5PENgg` with the command above.
3. Pull/rebuild/restart CP so the new publish payload/callback logic is live.
4. Run Publishing check from CP, confirm `DRY_RUN` record updates.
5. Publish one approved image post to Facebook and confirm CP records `PUBLISHED` with platform post ID/URL.
6. Test a multi-image approved request and confirm it creates one Facebook post with attached media.
## 2026-07-09 Facebook publishing credential convention

Agreed naming for the first live Facebook publishing integration:

- n8n Docker env must use `FUTURE_OILS_FACEBOOK_PAGE_ID` for the Future Oils Facebook Page ID.
- n8n Docker env must use `FUTURE_OILS_FACEBOOK_ACCESS_TOKEN` for the Future Oils Page access token.
- API version can use `META_GRAPH_API_VERSION`, currently expected as `v23.0`.
- Do not use generic `FACEBOOK_PAGE_ID` / `FACEBOOK_PAGE_ACCESS_TOKEN` in the new workflow.
- Do not commit real Facebook tokens to Git. These values belong in the n8n Docker/Plesk environment only.
- Future multi-page support should follow the same brand-specific pattern, e.g. `<BRAND_KEY>_FACEBOOK_PAGE_ID` and `<BRAND_KEY>_FACEBOOK_ACCESS_TOKEN`.

## 2026-07-08 separate image per product implementation

Implemented after the combined multi-product image was judged too crowded and products appeared too small.

- Preferred architecture: one CP creative job contains all selected product IDs; n8n returns one full-size image per product in one ordered signed callback. CP attaches all images to the same content request and later passes the ordered set to one publishing job. CP does not create separate text posts.
- Synced from live workflow `FF Admin - Creative Image Generation` (`rWQZP7saIkXUXDUD`) before editing.
- Restore backup: `workflows/n8n/backups/creative-image-generation-backup-2026-07-08-19-27.json`.
- `Compose Brand Image With Sharp` now renders each product separately at the established full single-product frame and returns `composed_files[]`; it no longer creates group/lineup layouts.
- `Prepare Completed CP Callback` now sends ordered `files[]`, including product asset ID and position, and signs the complete callback body.
- CP callback route accepts up to 10 MiB, stores every returned JPEG, creates one ordered creative asset per product, and cleans up all stored files on transaction failure.
- Approve, reject, and regenerate actions operate on the complete image set.
- Marketing Studio shows all current images in an ordered responsive grid and approves them together.
- Publishing job payload now includes legacy single-asset fields plus ordered `creative_asset_ids` and `creative_assets`. Actual Meta multi-photo/carousel publishing remains a later publishing-workflow concern; the current repository still keeps live Meta publishing blocked.
- Validation passed: creative workflow build/check, secret scan, TypeScript check, diff check, and a two-file callback/HMAC execution test. Local Sharp rendering was not run because Sharp is installed only in the production n8n image.
- User confirmed CP was pulled, built, and restarted. Deployed and activated live workflow `rWQZP7saIkXUXDUD`; live `updatedAt`: `2026-07-08T16:43:37.367Z`.
- Re-export verification passed: active=true, 7 nodes, separate-image mode present, `composed_files` present, multi-file callback present, and zero Magnific nodes.

Pending real test:
1. Test 17L + 18L and confirm two full-size JPEGs arrive, both appear in CP, approval selects both, and callback body stays under the configured limit.


## 2026-07-08 17L approval and 17L/18L CP product-selection fix

Completed after a `17 & 18 Liter Sunflower oil` request first failed approval and then generated only the 1L image.

- Approved `sunflower-oil-17l` for marketing in `public/assets/brand-profile.json`; 18L was already approved. Commit: `c03f9fc`.
- User confirmed the request passed after pulling the approval change, but the resulting image contained only 1L.
- Read-only inspected live successful n8n execution `18321` for workflow `rWQZP7saIkXUXDUD`.
- Verified live input had `product: Refined Sunflower Oil`, empty `product_asset_id`/`product_asset_ids`, and no topic; resolver therefore selected `sunflower-oil-1l` via generic fallback scoring.
- Root cause was CP resolving product assets only from `content.product`, while the capacities existed in `content.topic`.
- Updated CP creative dispatch to resolve product IDs from `content.product + content.topic`, include `topic` in the n8n payload, and recognize standalone paired capacities such as `17 & 18 Liter`.
- Direct parser verification: the reported request resolves `sunflower-oil-18l,sunflower-oil-17l`.
- TypeScript validation passed with `node node_modules\typescript\bin\tsc --noEmit`; diff validation passed. The focused Vitest runner was unavailable in local `node_modules`, so that test was not executed.
- Updated the stale public asset test expectation to record 17L as approved.
- CP fix commit: `b6d6d2d`. Both commits are pushed to `origin/develop`.
- No n8n workflow change, deployment, backup, or restart was required for this fix.

Deployment status: the CP fix requires pulling `develop` and rebuilding/restarting CP. After deployment, retry the same 17L + 18L request and verify that the image contains both products.


## 2026-07-08 unavailable 12L/13L no-fallback resolver fix

Completed after user reported request `new products are here 12 & 13 Liter tin` produced a 1L image.

- Exported current live `FF Admin - Creative Image Generation` before editing.
- Saved restore backup at `workflows/n8n/backups/creative-image-generation-backup-2026-07-08-17-47.json`.
- Reproduced locally: resolver detected capacity 13L but no matching 13L approved asset existed, then fallback scoring selected first approved product, 1L.
- Also fixed capacity extraction so `12 & 13 Liter` detects both 12L and 13L.
- New rule: if the request names explicit capacities and none of those capacities match approved product assets, resolver returns no product with reason `requested product capacities are unavailable: 12L, 13L` instead of guessing another product.
- Composer now surfaces `contract.product_resolution.reason` as the error when no product path exists.
- Local verification:
  - `new products are here 12 & 13 Liter tin` -> no product, reason unavailable 12L/13L.
  - `10L Refined Sunflower Oil` -> `sunflower-oil-10l`.
- Deployed and activated live workflow `rWQZP7saIkXUXDUD`. Live n8n `updatedAt`: `2026-07-08T14:48:46.371Z`.
- Re-exported live workflow and confirmed no-fallback rule is present.
- Verification passed: workflow check, secret scan, TypeScript check.

Important: repo asset folder currently has no 12L or 13L product PNG/profile entries. To generate 12L/13L images, add approved 12L/13L product assets to `public/assets/products` and `public/assets/brand-profile.json`, then pull those assets to Plesk.

## 2026-07-08 Resolve Brand Assets regex regression fix

Completed after user reported live n8n error: `Problem in node ?Resolve Brand Assets? - Nothing to repeat`.

- Exported current live `FF Admin - Creative Image Generation` (`rWQZP7saIkXUXDUD`) before editing.
- Saved restore backup at `workflows/n8n/backups/creative-image-generation-backup-2026-07-08-17-40.json`.
- Reproduced locally by executing the live-synced `Resolve Brand Assets` code with a 10L payload.
- Root cause: Arabic unit alternatives in the new multi-capacity regex were corrupted into question marks in the n8n Code node source, producing an invalid regex and JavaScript `Nothing to repeat` error.
- Fixed resolver by removing Arabic alternatives from regex literals and keeping English capacity matching paths stable: L, lt, ltr, liter/liters, litre/litres.
- Rebuilt workflow, verified resolver locally with:
  - single `10L Refined Sunflower Oil` -> `sunflower-oil-10l`
  - multi `1L, 5L and 10L Refined Sunflower Oil` -> `sunflower-oil-1l`, `sunflower-oil-5l`, `sunflower-oil-10l`
- Deployed and activated live workflow `rWQZP7saIkXUXDUD`. Live n8n `updatedAt`: `2026-07-08T14:42:01.024Z`.
- Re-exported live workflow after deploy and confirmed active=true, 7 nodes, no corrupted question-mark regex remains, and multi-product fields are still present.
- Verification passed: `node scripts/check-creative-image-workflows.mjs`, `node scripts/secret-scan.mjs`, and `node node_modules\typescript\bin\tsc --noEmit`.

Next operator test: retry the single 10L request first. Then retry multi-product text requests.

## 2026-07-08 multi-product fixed-template composition update

Completed after syncing from current live n8n first:

- Exported current live `FF Admin - Creative Image Generation` (`rWQZP7saIkXUXDUD`) before editing.
- Saved restore backup at `workflows/n8n/backups/creative-image-generation-backup-2026-07-08-17-24.json`.
- Updated CP creative image payload creation in `src/server/routes/content.ts` so requests include both legacy `product_asset_id` and new `product_asset_ids` when the product text contains multiple known sizes.
- Updated `Resolve Brand Assets` to support:
  - legacy single `product_asset_id`
  - explicit `product_asset_ids` arrays/lists
  - multiple capacities inferred from product text such as `1L, 5L and 10L`
  - all approved products via `layout_mode: "all"`, `product_selection: "all"`, or `product_asset_ids: ["all"]`
- Resolver now returns backward-compatible `product_asset_id` and `product_path`, plus multi-product `product_asset_ids`, `product_paths`, and `products[]`.
- Updated `Compose Brand Image With Sharp` with deterministic multi-product layouts:
  - 1 product: current single product fit-frame behavior
  - 2 products: overlapping side-by-side slots, shared bottom baseline
  - 3 products: center hero product with two smaller side products, shared bottom baseline
  - 4+ products: lineup layout sorted by capacity, shared bottom baseline
- Products are still real PNG assets, transparent-trimmed before resize, resized with `fit: "inside"`, and bottom-aligned. No logo/headline/CTA/button/text panel/frame rectangle is added.
- Updated callback metadata to include `product_asset_ids` and `product_layout`.
- Updated `scripts/check-creative-image-workflows.mjs` to enforce multi-product resolver/composer fields.
- Rebuilt and contract-checked locally. Deployed and activated live workflow `rWQZP7saIkXUXDUD`. Live n8n `updatedAt`: `2026-07-08T14:29:42.801Z`.
- Re-exported live workflow after deploy and confirmed active=true, 7 nodes, multi-product resolver fields present, multi-product layout composer present, transparent trim present, bottom alignment present, and no Magnific nodes.
- Verification passed: `node scripts/check-creative-image-workflows.mjs`, `node scripts/secret-scan.mjs`, and `node node_modules\typescript\bin\tsc --noEmit`.

Testing status:

- End-to-end CP tests still need to be run from CP because local env does not contain CP/webhook signing credentials.
- Recommended test requests:
  - `1L and 5L Refined Sunflower Oil`
  - `5L and 10L Refined Sunflower Oil`
  - `1L, 5L and 10L Refined Sunflower Oil`
  - all approved products via explicit payload `product_asset_ids: ["all"]` or future UI support.

## 2026-07-08 fixed-template left-shift and transparent-trim update

Completed after syncing from current live n8n first:

- Exported current live `FF Admin - Creative Image Generation` (`rWQZP7saIkXUXDUD`) before editing.
- Saved restore backup at `workflows/n8n/backups/creative-image-generation-backup-2026-07-08-17-17.json`.
- 10L fit size was good but needed to move left; 5L looked small because product PNG padding was being included in resize bounds.
- Updated `Compose Brand Image With Sharp` frame to shift left while preserving the safe width/height:
  - `x = Math.round(width * 0.2086)`
  - `y = Math.round(height * 0.2290)`
  - `w = Math.round(width * 0.6105)`
  - `h = Math.round(height * 0.6469)`
- For 1080x1350 output, final frame is x=225, y=309, w=659, h=873.
- Product PNG is now transparent-trimmed before resize using Sharp `.trim({ threshold: 10, background: { r: 0, g: 0, b: 0, alpha: 0 } })`, then resized with `fit: "inside"` and `withoutEnlargement: false`.
- Product remains horizontally centered and bottom-aligned to `productFrame.y + productFrame.h - productHeight`.
- Updated workflow checker so transparent trimming is required and vertical centering is rejected.
- Rebuilt and contract-checked locally. Deployed and activated live workflow `rWQZP7saIkXUXDUD`. Live n8n `updatedAt`: `2026-07-08T14:17:53.949Z`.
- Re-exported live workflow after deploy and confirmed active=true, 7 nodes, new frame constants present, transparent trim present, bottom alignment present, no vertical centering, and no Magnific nodes.

Testing status:

- Static workflow/source verification passed.
- End-to-end CP test should be rerun with 10L to confirm the left shift, and 5L to confirm trimming makes it fill the fit area better. Then recheck 1L.

## 2026-07-08 fixed-template smaller safe fit-area update

Completed after syncing from current live n8n first:

- Exported current live `FF Admin - Creative Image Generation` (`rWQZP7saIkXUXDUD`) before editing.
- Saved restore backup at `workflows/n8n/backups/creative-image-generation-backup-2026-07-08-17-09.json`.
- The previous larger fit area made the 10L product overflow the requested area. Updated the virtual product frame to an inset/safe frame inside the detected `fit-area.png` guide.
- New source-reference frame on 1122x1402: x=272, y=321, w=685, h=907.
- New proportional frame in `Compose Brand Image With Sharp`:
  - `x = Math.round(width * 0.2424)`
  - `y = Math.round(height * 0.2290)`
  - `w = Math.round(width * 0.6105)`
  - `h = Math.round(height * 0.6469)`
- For 1080x1350 output, final frame is x=262, y=309, w=659, h=873.
- Product still uses `fit: "inside"`, `withoutEnlargement: false`, horizontal centering, and bottom alignment to `productFrame.y + productFrame.h - productHeight`.
- Confirmed no vertical centering, no product trim, no product ratio knobs, no visible frame, no extra logo/headline/CTA/button/text panel, and no Magnific nodes.
- Rebuilt and contract-checked locally. Deployed and activated live workflow `rWQZP7saIkXUXDUD`. Live n8n `updatedAt`: `2026-07-08T14:10:50.869Z`.
- Re-exported live workflow after deploy and confirmed active=true, 7 nodes, new smaller frame constants present, bottom alignment present, no vertical centering, no trim, and no Magnific nodes.

Testing status:

- Static workflow/source verification passed.
- End-to-end CP test should be rerun with 10L first, then 1L and 5L, to confirm all products fit inside the smaller safe frame and callback remains below the CP limit.

## 2026-07-08 fixed-template larger product fit-area update

Completed after syncing from current live n8n first:

- Exported current live `FF Admin - Creative Image Generation` (`rWQZP7saIkXUXDUD`) before editing.
- Saved restore backup at `workflows/n8n/backups/creative-image-generation-backup-2026-07-08-17-01.json`.
- Used the provided `fit-area.png` reference image in the workspace root. Detected black guide bbox on the 1122x1402 image: left=234, top=221, right=994, bottom=1228, w=761, h=1008.
- Updated `Compose Brand Image With Sharp` product frame to make products larger while preserving bottom/left alignment:
  - `x = Math.round(width * 0.2086)`
  - `y = Math.round(height * 0.1576)`
  - `w = Math.round(width * 0.6783)`
  - `h = Math.round(height * 0.7190)`
- For 1080x1350 output, final frame is x=225, y=213, w=733, h=971.
- Product remains resized with `fit: "inside"`, `withoutEnlargement: false`, horizontally centered, and bottom-aligned to `productFrame.y + productFrame.h - productHeight`.
- Confirmed no vertical centering, no product trim, no product ratio knobs, no extra logo/headline/CTA/button/text panel/frame rectangle.
- Rebuilt and contract-checked locally. Deployed and activated live workflow `rWQZP7saIkXUXDUD`. Live n8n `updatedAt`: `2026-07-08T14:02:28.212Z`.
- Re-exported live workflow after deploy and confirmed active=true, 7 nodes, new frame constants present, bottom alignment present, no vertical centering, no trim, and no Magnific nodes.

Testing status:

- Static workflow/source verification passed.
- End-to-end CP tests still need to be run from CP for 1L, 5L, and 10L because local env does not contain webhook signing secret or CP auth credentials.
- Expected operator test: dispatch CP image requests for 1L, 5L, and 10L; confirm each product is larger, fits inside the new virtual frame, is horizontally centered, touches the frame bottom, no black rectangle is visible, callback succeeds, CP receives JPEG, and callback body size remains under limit.

## 2026-07-08 fixed-template product bottom-alignment update

Completed after syncing from current live n8n first:

- Exported current live `FF Admin - Creative Image Generation` (`rWQZP7saIkXUXDUD`) before editing.
- Saved restore backup at `workflows/n8n/backups/creative-image-generation-backup-2026-07-08-16-52.json`.
- Synced local `workflows/n8n/generated/10-creative-image-generation.json` from that live export before modifying placement logic.
- Updated `Compose Brand Image With Sharp` fixed-template placement only.
- Product frame is now based on the detected black rectangle guide from the 1122x1402 reference template:
  - `x = Math.round(width * 0.2086)`
  - `y = Math.round(height * 0.2247)`
  - `w = Math.round(width * 0.5294)`
  - `h = Math.round(height * 0.6355)`
- For 1080x1350, expected frame is approximately x=225, y=303, w=572, h=858.
- Product is now resized with `fit: "inside"`, `withoutEnlargement: false`, horizontally centered, and bottom-aligned to the virtual frame using `productFrame.y + productFrame.h - productHeight`.
- Removed product trimming from fixed-template composition so the product bottom aligns to the actual PNG bounds supplied in the asset.
- Confirmed generated/live workflow has no vertical-centering formula, no `trim()`, and no fixed-template product ratio knobs such as `productWidthRatio`, `productHeightRatio`, or `product_capacity_scale`.
- Deployed and activated live workflow `rWQZP7saIkXUXDUD`. Live n8n `updatedAt`: `2026-07-08T13:53:00.774Z`.
- Re-exported live workflow after deploy and confirmed active=true, 7 nodes, frame constants present, bottom alignment present, no vertical centering, no trim, and no Magnific nodes.

Testing status:

- Static workflow/source verification passed.
- End-to-end CP tests for 1L, 5L, and 10L still need to be run from CP because local `../1.env` contains only n8n API credentials and does not contain the webhook signing secret or CP auth needed to generate valid signed requests.
- Expected operator test: dispatch CP image requests for 1L, 5L, and 10L; confirm each product fits inside the virtual frame, is horizontally centered, touches the frame bottom, no black rectangle is visible, callback succeeds, CP receives JPEG, and callback body size remains under limit.

## 2026-07-08 fixed-template Sharp creative workflow

Completed after syncing from the current live n8n workflow first:

- Exported the live workflow `FF Admin - Creative Image Generation` (`rWQZP7saIkXUXDUD`) before editing.
- Saved a full restore backup at `workflows/n8n/backups/creative-image-generation-backup-2026-07-08-16-15.json`.
- Synced `workflows/n8n/generated/10-creative-image-generation.json` from the live export before making workflow changes.
- Confirmed the synced live workflow already contained the latest working fixes: Sharp composer node, capacity matching for known package sizes, JPEG/max callback size handling, and the working completed CP callback node.
- Added the approved fixed Future Oils template image at `public/assets/logo/background.png`.
- Removed/bypassed the Magnific background path from the creative workflow:
  - `Build Background Prompt`
  - `Generate Background With Magnific MCP`
  - `Prepare Magnific Wait Input`
  - `Wait For Magnific Creation`
- New live path is now: Webhook -> Validate Signed CP Request -> Acknowledge CP Request -> Resolve Brand Assets -> Compose Brand Image With Sharp -> Prepare Completed CP Callback -> Send Signed Callback To CP.
- `Resolve Brand Assets` now exposes `asset_contract.template_background_path` resolved safely from `BRAND_ASSETS_BASE_DIR/logo/background.png`, with the error `Fixed template background is unavailable` when missing.
- `Compose Brand Image With Sharp` now reads the fixed template directly, requires `contract.product_path`, places only the real product PNG inside the virtual product frame, and outputs JPEG. It no longer downloads a Magnific background, adds a logo, adds headline/CTA text, draws a button, or draws a text panel.
- `Prepare Completed CP Callback` kept the existing signed callback body shape and signature logic. Metadata now reports provider `fixed-template-sharp` and includes `template_background_source` instead of Magnific background metadata.
- Updated workflow source files and builder so future rebuilds keep the fixed-template workflow:
  - `workflows/n8n/code/resolve-brand-assets.js`
  - `workflows/n8n/code/compose-brand-image.js`
  - `workflows/n8n/code/prepare-completed-callback.js`
  - `scripts/build-creative-image-workflows.mjs`
  - `scripts/check-creative-image-workflows.mjs`
- Rebuilt and contract-checked locally: `node scripts/check-creative-image-workflows.mjs` passed with 7 nodes.
- Deployed and activated live workflow `rWQZP7saIkXUXDUD`. Live n8n `updatedAt`: `2026-07-08T13:33:09.749Z`.
- Re-exported live workflow after deploy. The export confirmed active=true, 7 nodes, no Magnific nodes, and fixed-template fields present.

Testing status:

- Local offline Sharp rendering could not run because this Google Drive workspace does not have local `sharp` installed, and npm installs should not be run here.
- A direct signed webhook test could not be generated locally because `../1.env` only contains n8n API credentials, not `N8N_WEBHOOK_SECRET` or CP auth credentials. This is expected and avoids storing production webhook secrets locally.
- Required next operator test: create/dispatch two CP image requests through the CP UI/API, one for a 1L product and one for a 10L product. Confirm CP receives JPEG files from `n8n-sharp-compositor`, products are centered in the template frame, no duplicate logo/text/CTA appears, and callback body size remains under the CP limit.

## 2026-07-08 protocol-relative image URL and topic-relevance fixes

Follow-up fixes after live testing:

- `Compose Brand Image With Sharp` received a protocol-relative Magnific URL like `//pikaso.cdnpk.net/...`. The composer now normalizes protocol-relative URLs to `https://...` before validation/download and extracts both `https://...` and `//...` candidates.
- Removed the temporary default that mapped generic sunflower-oil requests to `sunflower-oil-10l`. Product imagery is no longer guessed. n8n only uses a product asset when CP sends `product_asset_id` or the product string includes an explicit known size such as `10L`, `5L`, etc.
- Redeployed `FF Admin - Creative Image Generation` (`rWQZP7saIkXUXDUD`). Live n8n `updatedAt`: `2026-07-08T09:40:21.033Z`.
- Patched the active content-generation workflow so the requested topic/angle, objective, audience, channel, and CTA drive the post. The selected product remains authoritative product context but must not replace the requested topic with generic product copy.
- Patched `FF Admin - Content Request Intake - Draft` (`JgGTeTGe6CrP85b2`). Live n8n `updatedAt`: `2026-07-08T09:37:41.075Z`.

Operator notes:

- If an image request should include an exact product PNG, the CP request should send `product_asset_id` or the selected product should include a recognized package size. Generic `Refined Sunflower Oil` will not force a random package render.
- If content copy still misses the requested topic, inspect the latest content workflow execution payload and generated output; the live prompt now explicitly requires topic relevance.
## 2026-07-08 direct Magnific URL and default product asset fix

A later retry failed with `content [line 88]`. Read-only execution inspection showed the wait node had a valid URL at `content[0].text.results[0].results.url`, but the generic extraction still failed in the n8n Code node.

Live workflow fix completed:

- Composer now directly reads the known Magnific MCP shape from `Wait For Magnific Creation`: `content[].text.results[].results.url` before falling back to generic extraction.
- Resolver now infers a default product asset for generic sunflower-oil requests. If CP sends `Refined Sunflower Oil` without `product_asset_id`, n8n uses approved `sunflower-oil-10l`.
- Regenerated and redeployed `FF Admin - Creative Image Generation` (`rWQZP7saIkXUXDUD`).
- Live n8n `updatedAt`: `2026-07-08T09:24:14.919Z`.

Asset connection status:

- n8n asset base path is `/data/brand-assets`.
- This should be mounted from Plesk host path `/var/www/vhosts/future4site.com/cp.future4site.com/public/assets`.
- Latest executions prove n8n can read at least `/data/brand-assets/brand-profile.json` and `/data/brand-assets/logo/future-oils-logo.png`.
- However execution output showed `brand_theme: {}` and `layout_rules: {}`, while repo `public/assets/brand-profile.json` contains those keys. This means the Plesk-mounted asset folder is likely not pulled/updated to the latest repo assets, or n8n is mounted to an older copy. Pull latest CP repo/build on Plesk or replace the mounted `brand-profile.json` before judging final styling accuracy.
## 2026-07-08 explicit Magnific results URL extraction

A later retry failed at `Compose Brand Image With Sharp` with `Magnific result did not contain a background URL`, but read-only execution inspection showed `Wait For Magnific Creation` did return a usable asset URL at `content[].text.results[].results.url`.

Source and live workflow fix completed:

- Added `collectMagnificAssetUrls()` to explicitly read Magnific MCP result fields including `results.url`, `results.imageUrl`, `results.outputUrl`, `results.downloadUrl`, and `results.thumbnailUrl`.
- Composer now reads from the named `Wait For Magnific Creation` node output and prioritizes render image URLs before falling back to generic recursive extraction.
- Regenerated and redeployed `FF Admin - Creative Image Generation` (`rWQZP7saIkXUXDUD`).
- Live workflow remained active and was verified by read-only export.
- Live n8n `updatedAt`: `2026-07-08T09:15:05.251Z`.

Observation from failed execution `18251`: CP payload for `Refined Sunflower Oil` did not include a `product_asset_id`, so the resolver produced `product_path: null`. After the URL fix is verified, improve CP product asset resolution so generic sunflower-oil requests choose a default approved package asset instead of composing without product.
## 2026-07-08 Magnific background URL normalization fix

A retry reached `Compose Brand Image With Sharp` and failed with `Invalid Magnific background URL`. The composer was using the first raw URL candidate returned from the MCP result without enough normalization.

Source and live workflow fix completed:

- Added `addUrlCandidate()` to extract `http/https` URLs from strings, trim trailing punctuation, validate with `new URL()`, and ignore malformed candidates.
- Updated `collectUrls()` to handle URLs embedded inside text/JSON and URL-like keys such as `url`, `image`, `download`, `web`, and `src`.
- Kept the built-in `http`/`https` download path; no global `fetch` usage returned.
- Regenerated and redeployed `FF Admin - Creative Image Generation` (`rWQZP7saIkXUXDUD`).
- Live workflow remained active and was verified by read-only export.
- Live n8n `updatedAt`: `2026-07-08T09:07:43.153Z`.

Next operator check: retry the same CP image request. If another failure occurs, inspect the exact `Compose Brand Image With Sharp` error text and the preceding `Wait For Magnific Creation` output shape.
## 2026-07-08 Sharp composer fetch runtime fix

A live CP image-generation test reached `Compose Brand Image With Sharp` and failed with `fetch is not defined`. The n8n Code node runtime did not expose global `fetch`.

Source fix completed:

- Replaced `fetch(backgroundUrl)` in `workflows/n8n/code/compose-brand-image.js` with a deterministic `downloadBuffer()` helper using built-in `http` and `https` modules.
- Regenerated `workflows/n8n/generated/10-creative-image-generation.json`.
- Updated `.env.example` and `docs/N8N_SHARP_COMPOSITION.md`: `NODE_FUNCTION_ALLOW_BUILTIN` must be `fs,path,crypto,http,https` for this workflow.
- Updated the creative workflow contract check so future generated workflows must not contain `fetch(` and must include `http`/`https` imports.

Operational requirement before retrying the live image request:

- In the Plesk n8n container environment, update `NODE_FUNCTION_ALLOW_BUILTIN` from `fs,path,crypto` to `fs,path,crypto,http,https`, then restart/recreate the n8n container if Plesk does not apply env changes live.
## 2026-07-08 live Sharp creative workflow activation

Completed after the n8n runtime was reported to have the Sharp-enabled image:

- Updated `scripts/deploy-creative-image-workflows.mjs` so deployment preserves the existing live `mcpOAuth2Api` credential binding for MCP client nodes. The first activation attempt failed because n8n rejected the generated workflow without credentials on `Generate Background With Magnific MCP` and `Wait For Magnific Creation`.
- Deployed and activated `FF Admin - Creative Image Generation` on live n8n.
- Workflow ID: `rWQZP7saIkXUXDUD`.
- Live n8n `updatedAt`: `2026-07-08T08:47:44.233Z`.
- Read-only live export after deployment confirmed:
  - active: `true`
  - 11 nodes
  - 2 MCP client nodes
  - both MCP client nodes have `mcpOAuth2Api` credentials
  - includes `Resolve Brand Assets`, `Build Background Prompt`, `Generate Background With Magnific MCP`, `Wait For Magnific Creation`, and `Compose Brand Image With Sharp`
  - includes `brand_theme`, `layout_rules`, and `n8n-sharp-compositor`
  - no obsolete `Build Magnific MCP Request` reference remains

Not completed in this checkpoint:

- A direct signed webhook test from the local workstation could not run because local `1.env` contains n8n API credentials but not `N8N_WEBHOOK_SECRET`. This is expected because webhook secrets should remain in production env, not local handoff files.
- The next real test should be started from CP by creating/dispatching one image request for an approved product, preferably `10L Sunflower Oil`, then confirming the CP receives a composed `n8n-sharp-compositor` PNG and the Media/creative review image shows the exact real product/logo and brand styling.
## 2026-07-08 image-composition workflow status

Source update completed for the deterministic image-generation plan:

- Fixed the creative workflow builder so `Prepare Magnific Wait Input` reads from the actual `Build Background Prompt` node. The previous source referenced obsolete `Build Magnific MCP Request` naming and would break execution after Magnific returned.
- Added explicit `brand_theme` and `layout_rules` to `public/assets/brand-profile.json`.
- Extended the n8n asset resolver to pass `brand_theme` and `layout_rules` from `brand-profile.json` into the asset contract.
- Updated the Sharp composer to consume brand profile colors and layout ratios with safe fallbacks while still using the real logo and product PNG files.
- Strengthened the creative workflow contract check so obsolete node references fail validation.
- Regenerated `workflows/n8n/generated/10-creative-image-generation.json` only for the Sharp creative workflow.

Verification completed without npm because this workspace is on Google Drive and dependency installs are not reliable here:

- `node scripts/check-creative-image-workflows.mjs` passed: Sharp creative workflow contract passed with 11 nodes.
- Dependency-free local Node validation passed: `brand_id=future-oils`, 2 logos, 7 product entries, 11 workflow nodes, generated workflow inactive, no obsolete `Build Magnific MCP Request` reference, and all declared asset files exist.
- Read-only live n8n export on 2026-07-08 confirmed `FF Admin - Creative Image Generation` (`rWQZP7saIkXUXDUD`) is active but still the older Magnific-only URL callback workflow. It does not yet use `/data/brand-assets`, Sharp composition, or `n8n-sharp-compositor` callbacks.

Not completed yet:

- No live workflow replacement/activation was performed in this checkpoint. Replacing the active workflow must wait until the actual `n8n-newest` runtime proves Sharp can load and `/data/brand-assets/brand-profile.json` is readable.
- No real paid Magnific generation was triggered.
- No final live output image was verified because local Sharp testing is blocked by the Google Drive workspace dependency limitation, and the active live workflow is not yet the Sharp workflow.

Required next live preflight on Plesk before activation:

```bash
docker exec n8n-newest node -e "const fs=require('fs'); const sharp=require('sharp'); console.log(sharp.versions); console.log(fs.existsSync('/data/brand-assets/brand-profile.json'))"
```

Expected: Sharp version output and `true`.

After that passes, deploy/activate the generated Sharp workflow with the confirmation flags, run one CP image request end-to-end, visually inspect the final composed PNG, then update this handoff again with the live workflow version and output result.
## 2026-07-07 credential-file convention


- Local n8n operator credentials now load from the untracked `1.env` file, never `.env`.
- `1.env` is explicitly ignored by Git. Plesk container runtime values remain configured through the Docker environment UI.

## Latest deterministic Sharp creative pipeline

Implemented in source on **2026-07-06** and intentionally not activated live:

- Replaced whole-image generation with a background-only Magnific prompt that forbids products, packaging, logos, typography, badges, and people.
- Added a path-safe n8n brand resolver using `BRAND_ASSETS_BASE_DIR`, `brand-profile.json`, strict IDs, root containment checks, file existence checks, and `approved_for_marketing` enforcement.
- Added deterministic Sharp composition for exact logo, optional approved product cutout, headline, CTA, ratio, and final PNG dimensions.
- Extended CP creative job payloads with `brand_id`, `logo_id`, optional `product_asset_id`, `ratio`, and `visual_direction`. Size-specific product IDs are resolved only when the content product includes an available package size.
- Added signed composed-image callback ingestion. The CP decodes the Sharp PNG, stores it in private file storage, creates a `FileObject`, links the reviewable `CreativeAsset`, and removes base64 data from database metadata/events.
- Added `Dockerfile.n8n-sharp`, module allowlists, mount/preflight documentation, and an activation guard requiring `--confirm-sharp-ready`.
- Generated workflow remains inactive until the exact live n8n image version and execution-container topology are confirmed and the live Sharp/mount preflight passes.

Verification:

- Typecheck passed.
- `npm test` passed: 9 files, 30 tests.
- `npm run build` passed.
- Creative workflow contract passed with 11 nodes.
- ESLint passed for changed TypeScript/test files.
- Real Sharp composition passed using the public 10 L asset and logo: 1080 x 1350 PNG, 2,125,126 bytes.

Required before live activation:

1. Identify and pin the currently deployed n8n image tag/digest.
2. Confirm whether Code nodes execute in the main container, workers, or external task runners.
3. Build/deploy the Sharp-enabled image and mount Plesk `public/assets` read-only at `/data/brand-assets` in every execution container.
4. Run the documented container preflight.
5. Deploy the inactive workflow, inspect credential bindings, activate with all confirmation flags, and run one paid generation through CP review.
## Latest public brand-assets package

Implemented in source on **2026-07-06**:

- Added the existing Future Oils logo, emblem, and product render package under tracked `public/assets/`.
- Added `public/assets/brand-profile.json` with deterministic logo/product IDs and marketing approval flags. Existing 3 L and 17 L assets are retained but marked unavailable under current KB packaging rules.
- Configured Vite `publicDir` so `npm run build` copies `public/assets/` to `dist-client/assets/`. The running CP serves the files at `/assets/...` through its existing static server.
- Added `public/assets/README.md`, Plesk pull/build/mount documentation, and regression tests covering the manifest and every declared file.
- For n8n local access, mount the Plesk Git checkout's `public/assets` directory read-only at `/data/brand-assets`; do not mount replaceable `dist-client` output.

Verification used the clean local temporary copy:

- Typecheck passed.
- `npm test` passed: 8 files, 26 tests.
- `npm run build` passed.
- ESLint passed for the new test.
- Verified all 11 source files appeared in `dist-client/assets` with identical SHA-256 hashes.
- Deployment required: pull this commit on Plesk, run `npm ci && npm run build`, and restart the CP. No database migration or n8n workflow deployment is required for asset availability.
## Latest media ownership and deletion fix

Implemented in source on **2026-07-05**:

- Fixed generated-image discovery: the Media library now indexes valid generated image URLs regardless of whether the originating creative asset is active, rejected, superseded, or detached.
- Deleting a content request now keeps uploaded files in the Media library and detaches its original n8n-generated image assets into library ownership instead of deleting them with the request.
- Stored and generated images can both be permanently deleted from the Media library, even when linked to content. Deletion removes the CP creative-asset links and returns affected non-rejected/non-archived requests to copy review.
- Generated-image deletion groups duplicate creative-asset references by provider URL so the selected image disappears completely from the CP library.
- The Media library now uses an inline confirmation showing how many requests will be detached. External Facebook or Instagram posts are not modified.
- Updated file-storage documentation and media/request deletion regression coverage. No database migration is required.

Verification used the clean local temporary copy:

- Typecheck passed for client and server.
- `npm test` passed: 7 files, 23 tests.
- `npm run build` passed.
- ESLint passed for all changed TypeScript/test files.
- Deployment required: pull this commit on Plesk, run `npm ci && npm run build`, and restart the CP. No n8n deployment or database migration is required.

Historical limitation: generated image records already deleted by the previous request-deletion behavior cannot be recreated from the CP database. Recovery would require the original provider URL from n8n execution history or a database backup.
## Latest unrestricted content cleanup update

Implemented in source on **2026-07-05**:

- Content requests can now be permanently deleted from the CP in every state, including draft, processing, failed, rejected, archived, approved, queued, and published.
- Deletion removes the request's copy versions, creative assets, approvals, publishing records, associated content and publishing automation jobs/events, and unshared stored files.
- Shared media-library files remain protected when another request still uses them.
- The Content detail view now always exposes `Delete request`, followed by an inline irreversible-action confirmation. The warning states that external Facebook or Instagram posts are not removed by deleting the CP record.
- Added deletion regression coverage for unrestricted statuses, relationship cleanup, and UI availability.
- No database migration is required.

Verification used a clean local temporary copy because the synced-drive `node_modules` remains unusable:

- Typecheck passed for client and server.
- `npm test` passed: 7 files, 23 tests.
- `npm run build` passed for the Vite client and TypeScript server.
- ESLint passed for all changed TypeScript/test files.
- Secret scan and `git diff --check` passed.

Deployment status: source is ready, but the CP production application must pull this commit, run `npm ci && npm run build`, and restart. No n8n workflow deployment or database migration is needed for this update.
## Latest multi-product workflow fix

Applied to source and the active live n8n workflows on **2026-07-05**:

- Fixed text generation so the Control Panel's selected product is authoritative. Sugar, steel, metals, edible oils, and other legitimate products are no longer rejected merely because of their category.
- Removed edible-oil-only evidence, packaging fallbacks, hashtags, and output validation rules from the general content workflow. Safety rules against unsupported prices, guarantees, certifications, supplier details, specifications, grades, packaging, and standards remain.
- Fixed image generation so the selected product and brand determine the subject. The prompt no longer forces sunflower-oil bottles, golden-oil cues, or oil packaging for non-oil products.
- Added repeatable live patch scripts that preserve the active content workflow's Gemini configuration and restore/preserve the Magnific MCP OAuth credential reference during image-workflow updates.
- Added regression coverage for `Refined Sugar` and `Steel Rebar` across prompt construction, text validation, and image prompt construction.

Live verification:

- `FF Admin - Content Request Intake - Draft` (`JgGTeTGe6CrP85b2`) is active with the multi-product text fix.
- `FF Admin - Creative Image Generation` (`rWQZP7saIkXUXDUD`) is active with the multi-product image fix and its MCP OAuth credential binding intact.
- `node scripts/test-multi-product-workflows.mjs` passed for sugar and steel.
- `node scripts/check-n8n-workflows.mjs` passed.
- `node scripts/check-creative-image-workflows.mjs` passed (9 nodes).
- Read-only live inventory confirmed both workflows active. The inventory script exits non-zero because it also reports an older inactive `FF Admin - Magnific Generation - Draft`; this did not affect either active workflow.
- No real paid image generation was triggered during verification. The next operator check is one sugar image request and one steel image request from the Control Panel.
## Latest media library update

Implemented in `786f45f` (`Add reusable media library`) on 2026-06-29:

- Added a dedicated Media library page with upload, authenticated preview, search, usage counts, content links, and safe deletion of unused stored images.
- Added an inline library selector to image and carousel review so operators can reuse stored uploads or generated images across posts.
- Images uploaded during post review automatically appear in the shared library.
- Generated images are indexed from active creative assets and reused by URL. They are not copied into local storage automatically.
- In-use stored files cannot be deleted. Failed-request deletion preserves files reused by other requests and removes only unshared binaries.
- Added tracked `storage/images/.gitkeep`; real uploaded binaries remain ignored by Git and are organized under `FILE_STORAGE_PATH/images/YYYY-MM-DD/`.
- No Prisma schema change or database migration is required.

Verification:

- `npm run build` passed, including client and server typecheck.
- `npm test` passed: 6 files, 20 tests.
- ESLint passed for all changed code files.
- `node scripts/secret-scan.mjs` passed.
- `git diff --check` passed.

Plesk must configure a writable persistent `FILE_STORAGE_PATH`; see `docs/DEPLOYMENT_PLESK.md` and `docs/FILE_STORAGE.md`.
## Latest CP manual-control update

Implemented in `6c75d66` (`Add manual content and failure controls`) on 2026-06-29:

- Generated copy can be edited inline (headline, caption, hashtags, and CTA), regenerated, rejected, or approved from the copy-review stage.
- Image and carousel requests can use a generated asset or an operator-uploaded PNG, JPEG, or WebP image. Uploaded files use private authenticated storage and follow the same creative review and Publishing gate.
- A dedicated Failed filter restores retry, archive, and guarded permanent-delete controls. Permanent deletion is limited to failed requests with no publishing history and removes related jobs, events, approvals, assets, file records, items, and the request.
- Creative approval supersedes other candidate assets so Publishing receives only the selected approved creative.
- Plesk must keep `FILE_STORAGE_DRIVER=local` and `FILE_STORAGE_PATH` on writable persistent storage for uploaded-image previews.

Verification used a clean local temporary copy because the synced-drive `node_modules` installation is corrupted:

- `npm run typecheck` passed.
- `npm test` passed: 5 files, 15 tests.
- `npm run build` passed for the Vite client and TypeScript server.
- ESLint passed for all seven changed files.
- `node scripts/secret-scan.mjs` passed.
- Full-repository lint still reports pre-existing `no-useless-escape` errors in `scripts/build-creative-image-workflows.mjs` plus existing console warnings; none are introduced by this CP update.

Live n8n clarification: `FF Admin - Creative Image Generation` (`rWQZP7saIkXUXDUD`) is active and uses the MCP/OAuth-only design from GitHub commit `a881e2b`. The separate result-callback workflow was removed. The older creative workflow notes below are historical and should not be used as the restart state.
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
