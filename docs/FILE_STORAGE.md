# File Storage and Media Library

The CP stores file metadata and usage references in MySQL. Image binaries are stored under `FILE_STORAGE_PATH`, not inside the database.

## Media library

The internal Media library supports:

- Uploading PNG, JPEG, and WebP images.
- Authenticated image previews.
- Browsing stored uploads and generated images used by content.
- Selecting or reusing a stored or generated image across multiple content requests.
- Usage counts and links back to content requests.
- Permanent deletion of unused images.
- Deletion protection while an image is attached to active content.

Images uploaded directly during post review are also added to the shared library automatically. Generated images are indexed from active creative assets and remain hosted at their provider URL unless they were uploaded into local storage.

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

## Plesk configuration

Use an absolute, persistent directory outside any release folder that Plesk replaces during deployment:

```env
FILE_STORAGE_DRIVER=local
FILE_STORAGE_PATH=/var/www/vhosts/YOUR-DOMAIN/private/cp-storage
MAX_UPLOAD_MB=25
```

Create the directory once and give the Plesk application user read and write permission. The application creates the dated `images` subdirectories automatically.

For a simple deployment where the application directory itself persists, `FILE_STORAGE_PATH=./storage` also works. An external absolute path is safer when deployment replaces application files.

## Controls

- Upload size is limited by `MAX_UPLOAD_MB`.
- Only approved image MIME types are accepted by the gallery.
- File paths are resolved and checked against the configured storage root.
- Preview routes require an authenticated user with `content.read`.
- Upload, selection, reuse, and deletion require `content.write`.
- Images attached to active content cannot be deleted from the library.
- Failed-request deletion preserves files reused by other content requests.
- Virus scanning should be added before accepting files from untrusted external users.

## Long term

Object storage with private buckets and signed URLs can replace local storage later without moving file metadata into MySQL blobs.
