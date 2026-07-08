const crypto = require("crypto");

function removeUndefined(value) {
  if (Array.isArray(value)) return value.map(removeUndefined);
  if (value && typeof value === "object") {
    const cleaned = {};
    for (const [key, val] of Object.entries(value)) {
      if (val !== undefined) cleaned[key] = removeUndefined(val);
    }
    return cleaned;
  }
  return value;
}

const item = $json;
const secret = $env.PLATFORM_CALLBACK_SECRET;

if (!secret) throw new Error("Missing PLATFORM_CALLBACK_SECRET in n8n environment");
if (!item.cp?.callback_url) throw new Error("Missing callback_url from CP payload");

const composedFiles = Array.isArray(item.composed_files) && item.composed_files.length
  ? item.composed_files
  : item.composed_file?.data_base64
    ? [item.composed_file]
    : [];

if (!composedFiles.length || composedFiles.some((file) => !file?.data_base64)) {
  throw new Error("Missing composed image data_base64");
}

const timestamp = new Date().toISOString();
const nonce = "n8n_composed_images_" + Date.now() + "_" + Math.random().toString(36).slice(2);
const creationId = String(item.provider_creation_id || item.cp.job_id);

const files = composedFiles.map((composed, index) => ({
  file_id: creationId + "_composed_" + (index + 1),
  type: "image",
  name: composed.name,
  mime_type: composed.mime_type,
  data_base64: composed.data_base64,
  size_bytes: composed.size_bytes,
  width: composed.width,
  height: composed.height,
  source: "n8n-sharp-compositor",
  product_asset_id: composed.product_asset_id || null,
  position: composed.position || index + 1
}));

const publicFiles = files.map(({ data_base64, ...file }) => file);
const publicAssetContract = {
  brand_id: item.asset_contract?.brand_id || null,
  logo_id: item.asset_contract?.logo_id || null,
  product_asset_id: item.asset_contract?.product_asset_id || null,
  product_asset_ids: item.asset_contract?.product_asset_ids || [],
  ratio: item.asset_contract?.ratio || null,
  profile_version: item.asset_contract?.profile_version || null,
  template_background_source: item.template_background_source || null
};

const callbackBody = removeUndefined({
  job_id: item.cp.job_id,
  correlation_id: item.cp.correlation_id,
  idempotency_key: item.cp.idempotency_key,
  workflow_type: "creative_image_generation",
  workflow_version: "creative-image-sharp-v2-multi-file",
  status: "completed",
  current_step: files.length === 1 ? "Branded image composed and ready for review" : `${files.length} branded images composed and ready for review`,
  nonce,
  signature_timestamp: timestamp,
  signature: "",
  outputs: {
    provider: "fixed-template-sharp",
    asset_contract: publicAssetContract,
    product_layout: item.product_layout,
    files: publicFiles
  },
  files,
  warnings: []
});

const raw = JSON.stringify(callbackBody);
const signature = crypto
  .createHmac("sha256", secret)
  .update(timestamp + "." + nonce + "." + raw)
  .digest("hex");

return [{
  json: {
    callback_url: item.cp.callback_url,
    callback_headers: { signature, timestamp, nonce },
    callback_body: callbackBody,
    callback_debug: {
      body_size_bytes: Buffer.byteLength(raw, "utf8"),
      file_count: files.length,
      total_file_size_bytes: composedFiles.reduce((total, file) => total + Number(file.size_bytes || 0), 0),
      file_names: composedFiles.map((file) => file.name),
      has_body_nonce: true,
      has_body_signature_timestamp: true,
      has_body_signature_field: true
    }
  }
}];
