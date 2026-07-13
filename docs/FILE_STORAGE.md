# File Storage, Media Library, and Knowledge Library

The CP stores file metadata and usage references in MariaDB. File binaries are stored under `FILE_STORAGE_PATH`, not inside the database.

## Media library

The internal Media library supports:

- Uploading PNG, JPEG, and WebP images.
- Authenticated image previews.
- Browsing stored uploads and generated images used by content.
- Selecting or reusing a stored or generated image across multiple content requests.
- Usage counts and links back to content requests.
- Permanent deletion of stored and generated images, including detaching their CP content uses.
- Generated images remain in the library when their originating content request is deleted.

Images uploaded directly during post review are also added to the shared library automatically. Generated images are indexed from creative assets, remain hosted at their provider URL, and are detached into the library when their originating request is deleted.

## Storage layout

The repository includes `storage/images/.gitkeep` so a local image directory exists after checkout. Uploaded binaries are ignored by Git.

New image files are stored under:

```text
FILE_STORAGE_PATH/
  images/
    YYYY-MM-DD/
      generated-id-original-name.ext
```

The database stores the storage key, original name, MIME type, size, SHA-256 hash, approval state, and creative-asset references.

Knowledge Library originals use the controlled layout:

```text
FILE_STORAGE_PATH/
  knowledge-base/
    YYYY/
      MM/
        document-id/
          version-id/
            opaque-name.extension
```

Knowledge files are private, use immutable versions, and are downloaded only through authenticated routes. They are never stored in Git, `public`, `dist`, `dist-client`, `httpdocs`, or another build/release directory. See `docs/KNOWLEDGE_LIBRARY.md`.

## Plesk configuration

Use an absolute, persistent directory outside any release folder that Plesk replaces during deployment:

```env
FILE_STORAGE_DRIVER=local
FILE_STORAGE_PATH=/var/www/vhosts/YOUR-DOMAIN/private/cp-storage
MAX_UPLOAD_MB=25
```

Create the directory once and give the Plesk application user read and write permission. The application creates controlled `images` and `knowledge-base` subdirectories automatically.

For a simple deployment where the application directory itself persists, `FILE_STORAGE_PATH=./storage` also works. An external absolute path is safer when deployment replaces application files.

## Controls

- Upload size is limited by `MAX_UPLOAD_MB`.
- Only approved image MIME types are accepted by the gallery.
- File paths are resolved and checked against the configured storage root.
- Preview routes require an authenticated user with `content.read`.
- Upload, selection, reuse, and deletion require `content.write`.
- Deleting a library image removes its CP creative-asset links and returns affected content requests to review.
- Deleting a content request keeps its uploaded and generated images available in the library.
- Virus scanning should be added before accepting files from untrusted external users.
- Knowledge uploads enforce an extension allowlist, declared/detected MIME agreement, safe content signatures, SHA-256, and private attachment downloads.
- Knowledge files record `SCAN_UNAVAILABLE` until a stable antivirus integration exists; that status is not an antivirus guarantee.

## Long term

Object storage with private buckets and signed URLs can replace local storage later without moving file metadata into MySQL blobs.
