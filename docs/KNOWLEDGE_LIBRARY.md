# Private Knowledge Library

Phase 1A adds an operator-managed private document library. It stores original files and immutable versions, but it does not extract text, approve claims, or send knowledge to Gemini or n8n.

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
