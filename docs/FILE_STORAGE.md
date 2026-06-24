# File Storage

Database tables store metadata and references, not large binaries.

## MVP

- Local persistent storage path configured by `STORAGE_ROOT`.
- File metadata in `FileObject` and linked entities.
- Private files served only through authenticated routes.

## Long Term

- Object storage with private buckets.
- Signed access URLs.
- Separate public published assets from private supplier and commercial documents.

## Controls

- File size limits.
- MIME validation.
- Version references.
- Rejected assets remain archived and blocked from publication.
- Virus scanning should be added before accepting external uploads in production.

