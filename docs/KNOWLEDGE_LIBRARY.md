# Private Knowledge Library

## Phase 2B: explicit OCR proposals

Phase 2B adds separate operator-requested OCR jobs for PDF, PNG, JPEG, and WebP source versions. It is disabled by default with `KNOWLEDGE_OCR_ENABLED=false`. Tesseract performs Arabic, English, or bilingual OCR; Poppler `pdftoppm` rasterizes bounded PDF pages in an application-controlled temporary directory that is removed after each run.

OCR results record the immutable source checksum, actual engine version, language setting, duration, page count, page text hash, character counts, and confidence. Pages below `KNOWLEDGE_OCR_LOW_CONFIDENCE` are flagged. CP provides a private, authenticated inline source view beside OCR text. Inline views and downloads are separately audited.

OCR output is proposed source text only. It never changes source approval, creates or edits a claim, approves wording, enters the resolver, reaches content generation, or invokes n8n. Enabling OCR on Plesk requires verified Tesseract Arabic and English language packs, Poppler, absolute executable paths, resource monitoring, a representative bilingual accuracy set, and successful timeout/page/character/confidence/security/permission tests.

API:

- `GET /api/knowledge/documents/:id/versions/:versionId/ocr-jobs`
- `GET /api/knowledge/ocr-jobs/:jobId`
- `POST /api/knowledge/documents/:id/versions/:versionId/ocr-jobs`

`knowledge.ocr` is assigned to OWNER_ADMIN, MARKETING, and CONTENT_REVIEWER. Read-only roles may inspect completed results but cannot start OCR.

## Phase 2A: deterministic extraction

Phase 2A adds operator-triggered extraction records for immutable document versions. TXT and CSV use strict built-in UTF-8 decoding. PDF uses a configured Poppler `pdftotext` executable with fixed arguments, no shell, a timeout, and an output limit. The feature is disabled by default through `KNOWLEDGE_EXTRACTION_ENABLED=false`.

Each run records its source-version checksum, extractor identity, status, counts, timestamps, and page-aware text fragments. It does not alter the source file, source-review state, approved claims, `KnowledgeIndex`, prompts, content generation, n8n, or publishing. Extracted text is internal and is not eligible knowledge.

Enablement on Plesk requires installing or verifying Poppler outside the application, setting the absolute `KNOWLEDGE_PDFTOTEXT_PATH`, applying migration `202607150001_deterministic_knowledge_extraction`, regenerating Prisma Client, and completing TXT, CSV, PDF, timeout, unsupported-type, archived-document, rejected-file, permission, and response-leakage smoke tests. Leave the flag false if the executable or operational monitoring is unavailable.

API:

- `GET /api/knowledge/documents/:id/versions/:versionId/extractions`
- `GET /api/knowledge/extractions/:extractionId`
- `POST /api/knowledge/documents/:id/versions/:versionId/extractions`

`knowledge.extract` is assigned to OWNER_ADMIN, MARKETING, and CONTENT_REVIEWER. Read-only roles can inspect extraction status through `knowledge.read` but cannot start work.

## Phase 1B: human review and approved claims

Phase 1B adds controlled source review and manual factual claims. It does not extract files, translate wording, call Gemini or n8n, resolve knowledge for prompts, or publish anything.

### Source review

An immutable version moves through UPLOADED, READY_FOR_REVIEW, UNDER_REVIEW, then APPROVED_SOURCE or REJECTED. Reviewers can return a queued, active review, or rejected version to UPLOADED when correction is audit-safe. Every transition writes both a version review-history row and a sanitized audit event.

Only active documents whose file-security state is not REJECTED may enter review. Archived documents must be restored first. Rejection requires a reason. Approval belongs only to the exact immutable version.

Uploading a replacement never approves it. A previously approved version retains APPROVED_SOURCE and receives supersededAt for historical provenance; other predecessor states become SUPERSEDED. Rejecting the new version does not change the earlier approved source.

APPROVED_SOURCE means the version is trusted evidence. It does not approve any statement for marketing.

### Manual claims

- KnowledgeClaim is a stable claim key plus immutable revision number, lifecycle, usage scope, effective/expiration dates, restrictions, notes, actor fields, a direct revision predecessor, and the approved revision it is intended to replace.
- KnowledgeClaimTranslation stores manually entered locale wording. claimId plus locale is unique. English and Arabic are submitted, rejected, and approved independently.
- KnowledgeClaimSource links a claim to an immutable document version with optional page, heading, table/figure, short excerpt, and source notes.
- Brand, product, packaging format, market, audience, and content-objective associations define explicit applicability. Product and packaging restrictions never broaden to other products or sizes.

A claim can become APPROVED only when it is UNDER_REVIEW, at least one source is APPROVED_SOURCE, every required locale is independently APPROVED, usage scope is set, and at least one applicability value is set. Drafts are the only editable revisions. Approved, rejected, expired, superseded, and historical revisions are immutable; correcting any decided revision requires a new draft with the same stable key and the next revision.

Creating a draft revision never alters the current approved revision. Final approval of a replacement locks all rows for the stable claim key, verifies that the target draft still points to the single current approved revision, approves the replacement, and marks that predecessor SUPERSEDED in one transaction. Stale, repeated, and conflicting attempts return a conflict without a partial transition. Separate audit events record the replacement approval and predecessor supersession. A rejected conceptual claim that has never had an approved revision may also start a new draft; approving that draft creates the first approved revision and does not rewrite the rejected row.

The future-eligibility flag is informational only. It is true only for APPROVED, PUBLIC_SAFE, currently effective, unexpired, non-superseded claims. No generation path reads it in Phase 1B.

### Separation of duties

OWNER_ADMIN has all knowledge permissions and an explicit owner self-approval override. MARKETING may read/upload/edit documents and create/edit draft claims, but cannot review or approve. CONTENT_REVIEWER may read, review and approve sources, wording, and claims. READ_ONLY_MANAGEMENT remains read-only. OPERATIONS and AUTOMATION_MAINTAINER have no Knowledge Library access by default.

A non-owner user who created or most recently edited a claim cannot approve its localized wording or give final claim approval. Server checks are authoritative.

### Phase 1B API

- POST /api/knowledge/documents/:id/versions/:versionId/submit-review
- POST /api/knowledge/documents/:id/versions/:versionId/begin-review
- POST /api/knowledge/documents/:id/versions/:versionId/approve-source
- POST /api/knowledge/documents/:id/versions/:versionId/reject
- POST /api/knowledge/documents/:id/versions/:versionId/return-uploaded
- GET/POST /api/knowledge/claims
- GET/PATCH /api/knowledge/claims/:id
- GET /api/knowledge/claims/:id/revisions
- POST/PATCH /api/knowledge/claims/:id/translations/:locale
- POST /api/knowledge/claims/:id/translations/:locale/submit-review
- POST /api/knowledge/claims/:id/translations/:locale/approve
- POST /api/knowledge/claims/:id/translations/:locale/reject
- POST /api/knowledge/claims/:id/submit-review
- POST /api/knowledge/claims/:id/approve
- POST /api/knowledge/claims/:id/reject
- POST /api/knowledge/claims/:id/supersede

Generic PATCH accepts editable draft metadata only and uses a strict schema. It cannot assign approval, review, revision, stable-key, actor, or supersession state. Reviewed localized wording is immutable; generic translation PATCH can update only wording that is still DRAFT, and corrections after a review decision require a new claim revision.

Claim detail and revision-history responses identify the latest revision, the current approved revision, direct predecessor, intended approved predecessor, historical state, editability, translations, applicability, provenance, and available workflow context. Revision history is ordered by revision descending. Responses expose authenticated download routes, never storage keys or filesystem paths.

State-transition failures use 409 for stale or invalid transitions and 422 for incomplete final-approval requirements. Authentication, permission, and missing-record failures use 401, 403, and 404 respectively. The CP translates these into safe operator-facing explanations.

### Claim workspace

The Knowledge Library groups revisions by stable claim key. Operators can open every revision, see which one is latest and which one is currently approved, and inspect actors, timestamps, independently reviewed Arabic and English wording, applicability, immutable source-location metadata, and audit activity. Historical revisions are read-only.

Users with claim-edit permission can edit only the latest DRAFT revision. Users with the relevant review or approval permission receive explicit submit, review, approve, and reject actions. Creating a new revision uses an inline confirmation and leaves the approved revision active until the replacement is approved. Disabled actions explain the status, permission, self-approval, or historical-state reason. Source links open the matching document and immutable source version without revealing storage identity.

### Migration notes

Migration 202607130002_human_review_approved_claims is additive and introduces the Phase 1B enums, source-review history, claims, translations, provenance, applicability, and verified-brand relations. Migration 202607130003_claim_supersession_guard is a separate additive correction that adds nullable replacesApprovedClaimId, its index, and its self-referencing foreign key. The already-authored first migration was not modified.

Existing KnowledgeDocument, KnowledgeDocumentVersion, FileObject, Document, Product, PackagingFormat, and KnowledgeIndex rows remain valid. New relationships are nullable where existing rows need compatibility, and claim-domain foreign keys preserve history with Restrict or SetNull semantics. Neither migration has been executed against MariaDB in this workspace; backup, schema validation, client generation, migration execution, and production smoke tests remain deployment gates.

### KnowledgeIndex decision

KnowledgeIndex is unchanged. Repository inspection found only synthetic seed and purge references, but production contents were not queried because no production database access was used. Phase 1B does not migrate, delete, synchronize, or read KnowledgeIndex. Production record inspection remains a later-phase gate before any migration proposal.

Phase 1A added the operator-managed private document library. It stores original files and immutable versions and remains the storage foundation for Phase 1B.

## Data model

- KnowledgeDocument is the logical record and carries title, category, source type, locale, optional market and notes, lifecycle, creator, and timestamps.
- KnowledgeDocumentVersion is an immutable upload. Replacements create the next version under a database row lock; the prior version and file remain unchanged and are marked superseded.
- FileObject remains the physical-file metadata authority. It stores MIME information, extension, byte size, SHA-256, and file-security status.
- File security and business review are separate. SCAN_UNAVAILABLE means no antivirus result exists; it does not approve the document's content.
- Existing Document and KnowledgeIndex data is not migrated or changed.

## Private storage

Production must use an absolute persistent FILE_STORAGE_PATH outside httpdocs and every build/release directory. The application creates this controlled layout:

FILE_STORAGE_PATH/knowledge-base/YYYY/MM/document-id/version-id/opaque-name.extension

Clients cannot select a namespace or directory. Document/version IDs are restricted to safe path segments, generated filenames are opaque, and every read is checked against the storage root. Storage keys and filesystem paths are never returned by the API.

Allowed in Phase 1A: PDF, TXT, CSV, PNG, JPEG, and WebP, up to the configured limit (25 MB by default). DOC/DOCX, Excel formats, archives, SVG, HTML, executables, and scripts are rejected.

Uploads are checked by extension, declared MIME type, content signature or safe UTF-8 text detection, size, and SHA-256. A matching checksum returns a warning but does not block the upload. The original filename is sanitized and used only in metadata and the attachment header.

No stable antivirus integration exists in Phase 1A. New files therefore record SCAN_UNAVAILABLE. Upload access is restricted to trusted operators and downloads are private attachments with no-store and nosniff headers.

## Permissions

- OWNER_ADMIN: read, upload, edit, archive.
- MARKETING: read, upload, edit.
- CONTENT_REVIEWER: read.
- READ_ONLY_MANAGEMENT: read.
- AUTOMATION_MAINTAINER: no Knowledge Library access by default.

Server permission checks are authoritative. Navigation and actions follow the same permission mapping.

## API

- GET /api/knowledge/documents
- POST /api/knowledge/documents
- GET /api/knowledge/documents/:id
- PATCH /api/knowledge/documents/:id
- POST /api/knowledge/documents/:id/versions
- GET /api/knowledge/documents/:id/versions/:versionId/file
- POST /api/knowledge/documents/:id/archive
- POST /api/knowledge/documents/:id/restore

The list supports search, category, locale, market, ACTIVE/ARCHIVED/ALL lifecycle, file type, and upload-date filters. Archive is the only removal behavior; it preserves every database and file record. Authorized users can still download archived versions.

All create, upload, replacement, metadata edit, download, archive, and restore operations write audit events without file content, storage keys, paths, tokens, or secrets.

## Phase boundary

Documents are not available to AI content generation in Phase 1A. There is no extraction, OCR, approved-claim model, embedding/vector search, Gemini integration, n8n integration, permanent deletion, or antivirus guarantee.
