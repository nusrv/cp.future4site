import fs from "node:fs";
import path from "node:path";

const generatedDir = path.join(process.cwd(), "workflows", "n8n", "generated");
const referencePath = path.join(process.cwd(), "..", "Website", "public", "lovable-uploads", "sunflower-oil-1l.jpg");
if (!fs.existsSync(referencePath)) throw new Error(`Missing approved product reference: ${referencePath}`);
fs.mkdirSync(generatedDir, { recursive: true });
const productReference = fs.readFileSync(referencePath).toString("base64");

function codeNode(id, name, jsCode, position) {
  return { id, name, type: "n8n-nodes-base.code", typeVersion: 2, position, parameters: { jsCode } };
}

function webhookNode(id, name, webhookPath, position) {
  return { id, name, type: "n8n-nodes-base.webhook", typeVersion: 2, position, parameters: { path: webhookPath, httpMethod: "POST", responseMode: "responseNode", options: {} } };
}

function respondNode(id, name, position, responseBody) {
  return { id, name, type: "n8n-nodes-base.respondToWebhook", typeVersion: 1, position, parameters: { respondWith: "json", responseBody, options: {} } };
}

function callbackNode(id, position) {
  return {
    id,
    name: "Send Signed Callback To CP",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4,
    position,
    parameters: {
      method: "POST",
      url: "={{ $json.callback_url }}",
      sendHeaders: true,
      headerParameters: { parameters: [
        { name: "content-type", value: "application/json" },
        { name: "x-ff-signature", value: "={{ $json.callback_headers.signature }}" },
        { name: "x-ff-timestamp", value: "={{ $json.callback_headers.timestamp }}" },
        { name: "x-ff-nonce", value: "={{ $json.callback_headers.nonce }}" }
      ] },
      sendBody: true,
      specifyBody: "json",
      jsonBody: "={{ $json.callback_body }}",
      options: {}
    }
  };
}

function writeWorkflow(file, name, nodes, connections) {
  const workflow = {
    name,
    active: false,
    nodes,
    connections,
    settings: { executionOrder: "v1", saveManualExecutions: true, saveDataErrorExecution: "all", saveDataSuccessExecution: "all" },
    tags: ["future-foresight", "creative-image", "production-ready"]
  };
  fs.writeFileSync(path.join(generatedDir, file), `${JSON.stringify(workflow, null, 2)}\n`);
}

const validateCpRequest = `const crypto = require("crypto");
const envelope = $json;
const body = envelope.body ?? envelope;
const headers = envelope.headers ?? {};
const signature = String(headers["x-ff-signature"] ?? "");
const timestamp = String(headers["x-ff-timestamp"] ?? "");
const nonce = String(headers["x-ff-nonce"] ?? "");
const secret = $env.N8N_WEBHOOK_SECRET;
if (!secret) throw new Error("Missing N8N_WEBHOOK_SECRET in n8n environment");
if (!signature || !timestamp || !nonce) throw new Error("Missing CP request signature headers");
if (!body.job_id || !body.correlation_id || !body.callback_url) throw new Error("Missing job_id, correlation_id, or callback_url");
if (body.workflow_type !== "creative_image_generation") throw new Error("Unexpected workflow_type");
const drift = Math.abs(Date.now() - Date.parse(timestamp));
if (!Number.isFinite(drift) || drift > 5 * 60 * 1000) throw new Error("CP request timestamp rejected");
const raw = JSON.stringify(body);
const expected = crypto.createHmac("sha256", secret).update(timestamp + "." + nonce + "." + raw).digest("hex");
const supplied = Buffer.from(signature, "hex");
const calculated = Buffer.from(expected, "hex");
if (supplied.length !== calculated.length || !crypto.timingSafeEqual(supplied, calculated)) throw new Error("Invalid CP request signature");
return [{ json: { cp: body, accepted: true, received_at: new Date().toISOString() } }];`;

const buildMagnificRequest = `const cp = $json.cp;
const payload = cp.payload ?? {};
const base = "https://wap.nusrv.com/webhook/future-foresight/creative-image-result";
const query = new URLSearchParams({
  job_id: cp.job_id,
  correlation_id: cp.correlation_id,
  idempotency_key: cp.idempotency_key ?? "",
  workflow_type: cp.workflow_type ?? "creative_image_generation",
  workflow_version: cp.workflow_version ?? "creative-image-v1",
  callback_url: cp.callback_url
});
const headline = String(payload.headline ?? "").trim();
const caption = String(payload.caption ?? "").trim();
const product = String(payload.product ?? "Refined Sunflower Oil").trim();
const market = String(payload.market ?? "Gulf and MENA importers and distributors").trim();
const prompt = [
  "Premium commercial B2B social advertising photograph for Future Oils.",
  "Feature the exact Future Oils 1 L refined sunflower oil bottle from the structure reference as the clear hero product.",
  "Preserve the bottle shape, cap, label layout, Future Oils logo, brand colors, and packaging identity. Do not redesign or invent packaging text.",
  "Product: " + product + ". Audience and market: " + market + ".",
  headline ? "Campaign idea: " + headline + "." : "",
  caption ? "Message context: " + caption.slice(0, 600) + "." : "",
  "Bright premium studio product photography, clean white to very light neutral backdrop, warm natural sunflower-gold light, restrained deep olive accents, realistic golden oil cues, confident export-trade presentation.",
  "Portrait 4:5 composition for Facebook and Instagram with generous safe space. One hero bottle only unless the brief explicitly requires more.",
  "No added typography, no floating text, no badges, no price, no certification seals, no health claims, no people, no hands, no watermark, no distorted logo, no duplicate bottle, no clutter."
].filter(Boolean).join(" ");
return [{ json: {
  cp,
  magnific_request: {
    prompt,
    webhook_url: base + "?" + query.toString(),
    structure_reference: "${productReference}",
    structure_strength: 92,
    adherence: 68,
    hdr: 22,
    resolution: "2k",
    aspect_ratio: "social_post_4_5",
    model: "realism",
    creative_detailing: 20,
    engine: "magnific_sharpy",
    fixed_generation: false,
    filter_nsfw: true,
    styling: { colors: [
      { color: "#E0A51B", weight: 0.35 },
      { color: "#2E4A2E", weight: 0.2 },
      { color: "#F8F4EA", weight: 0.45 }
    ] }
  }
} }];`;

const prepareSubmissionCallback = `const crypto = require("crypto");
const built = $("Build Magnific Request").item.json;
const cp = built.cp;
const response = $json;
const data = response.data ?? response;
const accepted = Boolean(data.task_id);
const secret = $env.PLATFORM_CALLBACK_SECRET;
if (!secret) throw new Error("Missing PLATFORM_CALLBACK_SECRET in n8n environment");
const timestamp = new Date().toISOString();
const nonce = "n8n_image_submit_" + Date.now() + "_" + Math.random().toString(36).slice(2);
const callbackBody = {
  job_id: cp.job_id,
  correlation_id: cp.correlation_id,
  idempotency_key: cp.idempotency_key,
  workflow_type: "creative_image_generation",
  workflow_version: cp.workflow_version ?? "creative-image-v1",
  status: accepted ? "waiting_for_external_service" : "failed",
  current_step: accepted ? "Magnific accepted the image generation task" : "Magnific rejected the image generation task",
  nonce,
  signature_timestamp: timestamp,
  signature: "",
  outputs: accepted ? { provider: "magnific", task_id: data.task_id, provider_status: data.status ?? "IN_PROGRESS" } : {},
  files: [],
  warnings: [],
  error: accepted ? undefined : { code: "MAGNIFIC_SUBMIT_FAILED", message: String(response.message ?? response.error ?? "Magnific submission failed"), retryable: true }
};
if (!callbackBody.error) delete callbackBody.error;
const raw = JSON.stringify(callbackBody);
const signature = crypto.createHmac("sha256", secret).update(timestamp + "." + nonce + "." + raw).digest("hex");
return [{ json: { callback_url: cp.callback_url, callback_headers: { signature, timestamp, nonce }, callback_body: callbackBody } }];`;

writeWorkflow(
  "10-creative-image-generation.json",
  "FF Admin - Creative Image Generation",
  [
    webhookNode("creative-image-webhook", "CP Creative Image Request Webhook", "future-foresight/creative-image-generation", [0, 0]),
    codeNode("validate-cp-request", "Validate Signed CP Request", validateCpRequest, [250, 0]),
    respondNode("respond-cp", "Acknowledge CP Request", [500, 0], '={{ { accepted: true, job_id: $json.cp.job_id, workflow_type: "creative_image_generation" } }}'),
    codeNode("build-magnific-request", "Build Magnific Request", buildMagnificRequest, [750, 0]),
    {
      id: "submit-magnific",
      name: "Submit Mystic Image Generation",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4,
      position: [1000, 0],
      onError: "continueRegularOutput",
      parameters: {
        method: "POST",
        url: "https://api.magnific.com/v1/ai/mystic",
        sendHeaders: true,
        headerParameters: { parameters: [
          { name: "content-type", value: "application/json" },
          { name: "accept", value: "application/json" },
          { name: "x-magnific-api-key", value: "={{ $env.MAGNIFIC_TOKEN }}" }
        ] },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ $json.magnific_request }}",
        options: {}
      }
    },
    codeNode("prepare-submission-callback", "Prepare Submission Status Callback", prepareSubmissionCallback, [1250, 0]),
    callbackNode("send-submission-callback", [1500, 0])
  ],
  {
    "CP Creative Image Request Webhook": { main: [[{ node: "Validate Signed CP Request", type: "main", index: 0 }]] },
    "Validate Signed CP Request": { main: [[{ node: "Acknowledge CP Request", type: "main", index: 0 }]] },
    "Acknowledge CP Request": { main: [[{ node: "Build Magnific Request", type: "main", index: 0 }]] },
    "Build Magnific Request": { main: [[{ node: "Submit Mystic Image Generation", type: "main", index: 0 }]] },
    "Submit Mystic Image Generation": { main: [[{ node: "Prepare Submission Status Callback", type: "main", index: 0 }]] },
    "Prepare Submission Status Callback": { main: [[{ node: "Send Signed Callback To CP", type: "main", index: 0 }]] }
  }
);

const prepareResultCallback = `const crypto = require("crypto");
const envelope = $json;
const body = envelope.body?.data ?? envelope.body ?? envelope;
const headers = envelope.headers ?? {};
const query = envelope.query ?? {};
const webhookId = String(headers["webhook-id"] ?? "");
const webhookTimestamp = String(headers["webhook-timestamp"] ?? "");
const webhookSignatures = String(headers["webhook-signature"] ?? "");
const webhookSecret = $env.MAGNIFIC_WEBHOOK_SECRET;
if (!webhookSecret) throw new Error("Missing MAGNIFIC_WEBHOOK_SECRET in n8n environment");
if (!webhookId || !webhookTimestamp || !webhookSignatures) throw new Error("Missing Magnific webhook signature headers");
const timestampValue = /^\\d+$/.test(webhookTimestamp) ? Number(webhookTimestamp) * (webhookTimestamp.length <= 10 ? 1000 : 1) : Date.parse(webhookTimestamp);
const drift = Math.abs(Date.now() - timestampValue);
if (!Number.isFinite(drift) || drift > 5 * 60 * 1000) throw new Error("Magnific webhook timestamp rejected");
const raw = JSON.stringify(envelope.body ?? {});
const generated = crypto.createHmac("sha256", webhookSecret).update(webhookId + "." + webhookTimestamp + "." + raw).digest("base64");
const valid = webhookSignatures.split(/\\s+/).some((entry) => {
  const parts = entry.split(",");
  if (parts.length !== 2) return false;
  const supplied = Buffer.from(parts[1]);
  const expected = Buffer.from(generated);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
});
if (!valid) throw new Error("Invalid Magnific webhook signature");
if (!query.job_id || !query.correlation_id || !query.callback_url) throw new Error("Missing CP callback context");
const providerStatus = String(body.status ?? "IN_PROGRESS").toUpperCase();
const urls = Array.isArray(body.generated) ? body.generated.filter((url) => typeof url === "string") : [];
const nsfw = Array.isArray(body.has_nsfw) && body.has_nsfw.some(Boolean);
const complete = providerStatus === "COMPLETED" && urls.length > 0 && !nsfw;
const failed = nsfw || ["FAILED", "ERROR", "CANCELLED"].includes(providerStatus) || (providerStatus === "COMPLETED" && urls.length === 0);
const status = complete ? "completed" : failed ? "failed" : "waiting_for_external_service";
const callbackSecret = $env.PLATFORM_CALLBACK_SECRET;
if (!callbackSecret) throw new Error("Missing PLATFORM_CALLBACK_SECRET in n8n environment");
const timestamp = new Date().toISOString();
const nonce = "n8n_image_result_" + Date.now() + "_" + Math.random().toString(36).slice(2);
const files = complete ? urls.map((url, index) => ({ file_id: String(body.task_id ?? query.job_id) + "_" + index, type: "image", url, source: "magnific", provider_task_id: body.task_id ?? null })) : [];
const callbackBody = {
  job_id: String(query.job_id),
  correlation_id: String(query.correlation_id),
  idempotency_key: String(query.idempotency_key ?? ""),
  workflow_type: "creative_image_generation",
  workflow_version: String(query.workflow_version ?? "creative-image-v1"),
  status,
  current_step: complete ? "Magnific image is ready for review" : failed ? "Magnific image generation failed" : "Magnific image generation is in progress",
  nonce,
  signature_timestamp: timestamp,
  signature: "",
  outputs: { provider: "magnific", task_id: body.task_id ?? null, provider_status: providerStatus, generated_count: urls.length, has_nsfw: nsfw },
  files,
  warnings: nsfw ? ["Magnific flagged the generated image as unsafe; no asset was stored."] : [],
  error: failed ? { code: nsfw ? "MAGNIFIC_NSFW_REJECTED" : "MAGNIFIC_GENERATION_FAILED", message: nsfw ? "Magnific rejected the image through its safety filter" : String(body.message ?? body.error ?? "Magnific generation failed"), retryable: !nsfw } : undefined
};
if (!callbackBody.error) delete callbackBody.error;
const callbackRaw = JSON.stringify(callbackBody);
const signature = crypto.createHmac("sha256", callbackSecret).update(timestamp + "." + nonce + "." + callbackRaw).digest("hex");
return [{ json: { callback_url: String(query.callback_url), callback_headers: { signature, timestamp, nonce }, callback_body: callbackBody } }];`;

writeWorkflow(
  "13-creative-image-result-callback.json",
  "FF Admin - Creative Image Result Callback",
  [
    webhookNode("magnific-result-webhook", "Magnific Result Webhook", "future-foresight/creative-image-result", [0, 0]),
    codeNode("verify-and-map-result", "Verify Magnific And Prepare CP Callback", prepareResultCallback, [260, 0]),
    respondNode("respond-magnific", "Acknowledge Magnific Result", [520, 0], '={{ { received: true, task_id: $json.callback_body.outputs.task_id } }}'),
    callbackNode("send-result-callback", [780, 0])
  ],
  {
    "Magnific Result Webhook": { main: [[{ node: "Verify Magnific And Prepare CP Callback", type: "main", index: 0 }]] },
    "Verify Magnific And Prepare CP Callback": { main: [[{ node: "Acknowledge Magnific Result", type: "main", index: 0 }]] },
    "Acknowledge Magnific Result": { main: [[{ node: "Send Signed Callback To CP", type: "main", index: 0 }]] }
  }
);

console.log("Built production-ready creative image intake and result workflows.");