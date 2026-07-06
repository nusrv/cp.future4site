# n8n Sharp Brand Composition

## Status

Source implementation is ready. Do not activate the generated workflow until the live n8n execution container passes the Sharp and asset-mount preflight.

## Build image

Pin the exact currently deployed n8n image digest or tag:

```bash
docker build \
  --build-arg N8N_BASE_IMAGE=n8nio/n8n:<PINNED-LIVE-VERSION> \
  -f Dockerfile.n8n-sharp \
  -t future-foresight/n8n-sharp:<VERSION> .
```

## Required container configuration

```yaml
environment:
  BRAND_ASSETS_BASE_DIR: /data/brand-assets
  NODE_FUNCTION_ALLOW_BUILTIN: fs,path,crypto
  NODE_FUNCTION_ALLOW_EXTERNAL: sharp
volumes:
  - /ABSOLUTE-PLESK-CHECKOUT/public/assets:/data/brand-assets:ro
```

If Code nodes run in workers or external task runners, install Sharp, configure the allowlists, and mount `/data/brand-assets` in every execution container, not only the main n8n container.

## Preflight

Run inside the container that executes JavaScript Code nodes:

```bash
node -e "const fs=require('fs'); const sharp=require('sharp'); const p=process.env.BRAND_ASSETS_BASE_DIR + '/brand-profile.json'; console.log(sharp.versions); console.log(JSON.parse(fs.readFileSync(p,'utf8')).brand_id)"
```

Expected brand ID: `future-oils`.

## Pipeline

1. Validate signed CP request.
2. Resolve approved logo/product IDs from `brand-profile.json`.
3. Ask Magnific for a background plate only.
4. Download the returned background.
5. Compose exact logo, optional approved product cutout, headline, and CTA with Sharp.
6. Return the PNG as a signed base64 callback.
7. CP writes the PNG to private file storage and creates a reviewable `CreativeAsset`.

The callback stores no base64 data in database metadata or automation event summaries.