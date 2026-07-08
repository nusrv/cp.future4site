# Future Foresight CP - Session Handoff

Canonical restart point after any interrupted or completed session. Read this file first before changing the CP or its n8n workflows.

Last verified: **2026-07-08 (Asia/Amman)**

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
