const crypto = require("crypto");

function removeUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(removeUndefined);
  }

  if (value && typeof value === "object") {
    const cleaned = {};

    for (const [key, val] of Object.entries(value)) {
      if (val !== undefined) {
        cleaned[key] = removeUndefined(val);
      }
    }

    return cleaned;
  }

  return value;
}

const item = $json;
const secret = $env.PLATFORM_CALLBACK_SECRET;

if (!secret) {
  throw new Error("Missing PLATFORM_CALLBACK_SECRET in n8n environment");
}

if (!item.cp?.callback_url) {
  throw new Error("Missing callback_url from CP payload");
}

if (!item.composed_file?.data_base64) {
  throw new Error("Missing composed image data_base64");
}

const timestamp = new Date().toISOString();

const nonce =
  "n8n_composed_image_" +
  Date.now() +
  "_" +
  Math.random().toString(36).slice(2);

const file = {
  file_id: String(item.provider_creation_id || item.cp.job_id) + "_composed",
  type: "image",
  name: item.composed_file.name,
  mime_type: item.composed_file.mime_type,
  data_base64: item.composed_file.data_base64,
  size_bytes: item.composed_file.size_bytes,
  width: item.composed_file.width,
  height: item.composed_file.height,
  source: "n8n-sharp-compositor"
};

const publicFile = {
  file_id: file.file_id,
  type: file.type,
  name: file.name,
  mime_type: file.mime_type,
  size_bytes: file.size_bytes,
  width: file.width,
  height: file.height,
  source: file.source
};

const publicAssetContract = {
  brand_id: item.asset_contract?.brand_id || null,
  logo_id: item.asset_contract?.logo_id || null,
  product_asset_id: item.asset_contract?.product_asset_id || null,
  ratio: item.asset_contract?.ratio || null,
  profile_version: item.asset_contract?.profile_version || null,
  template_background_source: item.template_background_source || null
};

/**
 * نرجع شكل الـ body قريبًا من النسخة الأصلية.
 * مهم: نترك signature داخل body فارغًا أثناء حساب التوقيع.
 */
const callbackBody = removeUndefined({
  job_id: item.cp.job_id,
  correlation_id: item.cp.correlation_id,
  idempotency_key: item.cp.idempotency_key,
  workflow_type: "creative_image_generation",
  workflow_version: "creative-image-sharp-v1",
  status: "completed",
  current_step: "Branded image composed and ready for review",

  nonce,
  signature_timestamp: timestamp,
  signature: "",

  outputs: {
    provider: "fixed-template-sharp",
    asset_contract: publicAssetContract,
    files: [publicFile]
  },

  files: [file],
  warnings: []
});

const raw = JSON.stringify(callbackBody);

const signature = crypto
  .createHmac("sha256", secret)
  .update(timestamp + "." + nonce + "." + raw)
  .digest("hex");

return [
  {
    json: {
      callback_url: item.cp.callback_url,
      callback_headers: {
        signature,
        timestamp,
        nonce
      },
      callback_body: callbackBody,
      callback_debug: {
        body_size_bytes: Buffer.byteLength(raw, "utf8"),
        file_size_bytes: item.composed_file.size_bytes,
        file_mime_type: item.composed_file.mime_type,
        file_name: item.composed_file.name,
        has_body_nonce: true,
        has_body_signature_timestamp: true,
        has_body_signature_field: true
      }
    }
  }
];
