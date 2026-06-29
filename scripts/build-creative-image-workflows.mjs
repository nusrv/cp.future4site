import fs from "node:fs";
import path from "node:path";

const generatedDir = path.join(process.cwd(), "workflows", "n8n", "generated");
fs.mkdirSync(generatedDir, { recursive: true });

const MAGNIFIC_MCP_ENDPOINT = "https://mcp.magnific.com";

function codeNode(id, name, jsCode, position) {
  return { id, name, type: "n8n-nodes-base.code", typeVersion: 2, position, parameters: { jsCode } };
}

function webhookNode(id, name, webhookPath, position) {
  return { id, name, type: "n8n-nodes-base.webhook", typeVersion: 2, position, parameters: { path: webhookPath, httpMethod: "POST", responseMode: "responseNode", options: {} } };
}

function respondNode(id, name, position, responseBody) {
  return { id, name, type: "n8n-nodes-base.respondToWebhook", typeVersion: 1, position, parameters: { respondWith: "json", responseBody, options: {} } };
}

function mcpClientNode(id, name, tool, value, position) {
  return {
    id,
    name,
    type: "@n8n/n8n-nodes-langchain.mcpClient",
    typeVersion: 1,
    position,
    parameters: {
      endpointUrl: MAGNIFIC_MCP_ENDPOINT,
      authentication: "mcpOAuth2Api",
      tool: { __rl: true, mode: "list", value },
      parameters: {
        mappingMode: "defineBelow",
        value,
        matchingColumns: [],
        schema: [],
        attemptToConvertTypes: false,
        convertFieldsToString: false
      },
      options: {}
    }
  };
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
    tags: ["future-foresight", "creative-image", "magnific-mcp"]
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

const buildMagnificMcpRequest = `const cp = $json.cp;
const payload = cp.payload ?? {};
const headline = String(payload.headline ?? "").trim();
const caption = String(payload.caption ?? "").trim();
const product = String(payload.product ?? "Refined Sunflower Oil").trim();
const market = String(payload.market ?? "Gulf and MENA importers and distributors").trim();
const prompt = [
  "Create one premium photorealistic B2B social advertising image for Future Oils.",
  "The visual must promote " + product + " for " + market + ".",
  headline ? "Campaign headline context: " + headline + "." : "",
  caption ? "Post caption context: " + caption.slice(0, 700) + "." : "",
  "Use a portrait 4:5 social composition suitable for Facebook and Instagram.",
  "Use bright premium studio product photography, clean white to very light neutral background, warm sunflower-gold light, restrained deep olive accents, realistic golden oil cues, and a confident export-trade look.",
  "Show a single clear hero sunflower oil bottle/package with strong shelf appeal and realistic proportions.",
  "Do not add typography, floating text, badges, prices, certification seals, health claims, people, hands, watermarks, duplicate bottles, clutter, or distorted brand marks.",
  "Leave safe space around the product for platform cropping. The final image should be ready for human creative review before publishing."
].filter(Boolean).join(" ");
return [{ json: {
  cp,
  mcp_endpoint: "https://mcp.magnific.com",
  mcp_generate_args: { prompt },
  requested_output: { type: "image", aspect_ratio: "4:5", review_required: true }
} }];`;

const prepareMagnificWaitInput = `function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}
function collectCandidates(value, output = []) {
  const parsed = parseMaybeJson(value);
  if (parsed && typeof parsed === "object") {
    output.push(parsed);
    if (Array.isArray(parsed.content)) {
      for (const item of parsed.content) {
        if (item?.type === "text") collectCandidates(item.text, output);
        else collectCandidates(item, output);
      }
    }
    if (parsed.structuredContent) collectCandidates(parsed.structuredContent, output);
  }
  return output;
}
function findByKeys(value, keys, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findByKeys(item, keys, seen);
      if (found) return found;
    }
    return undefined;
  }
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
  }
  for (const nested of Object.values(value)) {
    const found = findByKeys(nested, keys, seen);
    if (found) return found;
  }
  return undefined;
}
const built = $("Build Magnific MCP Request").item.json;
const generationResult = $json;
const candidates = collectCandidates(generationResult);
let creationId;
for (const candidate of candidates) {
  creationId = findByKeys(candidate, ["identifier", "id", "creation_id", "creationId", "task_id", "taskId", "job_id", "jobId"]);
  if (creationId) break;
}
if (!creationId) {
  throw new Error("Magnific MCP images_generate did not return a creation identifier. Open this execution, inspect the MCP output, and adjust Prepare Magnific Wait Input to the live tools/list schema.");
}
return [{ json: {
  cp: built.cp,
  mcp_endpoint: built.mcp_endpoint,
  generation_result: generationResult,
  creation_id: creationId,
  mcp_wait_args: { identifier: creationId }
} }];`;

const prepareCompletedCallback = `const crypto = require("crypto");
function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}
function walk(value, visitor, seen = new Set()) {
  const parsed = parseMaybeJson(value);
  if (!parsed || typeof parsed !== "object" || seen.has(parsed)) return;
  seen.add(parsed);
  visitor(parsed);
  if (Array.isArray(parsed)) {
    for (const item of parsed) walk(item, visitor, seen);
    return;
  }
  for (const item of Object.values(parsed)) walk(item, visitor, seen);
}
function collectUrls(value) {
  const urls = new Set();
  const urlKeys = new Set(["url", "image_url", "imageUrl", "output_url", "outputUrl", "download_url", "downloadUrl", "public_url", "publicUrl"]);
  walk(value, (item) => {
    if (Array.isArray(item)) return;
    for (const [key, raw] of Object.entries(item)) {
      if (typeof raw === "string" && /^https?:\/\//.test(raw) && (urlKeys.has(key) || /image|generated|download|url/i.test(key))) urls.add(raw);
      if (Array.isArray(raw)) {
        for (const entry of raw) if (typeof entry === "string" && /^https?:\/\//.test(entry)) urls.add(entry);
      }
    }
    if (item.type === "image" && typeof item.data === "string") urls.add("data:" + String(item.mimeType ?? "image/png") + ";base64," + item.data);
  });
  return [...urls];
}
const built = $("Build Magnific MCP Request").item.json;
const waitInput = $("Prepare Magnific Wait Input").item.json;
const waitResult = $json;
const urls = [...new Set([...collectUrls(waitResult), ...collectUrls(waitInput.generation_result)])];
const complete = urls.length > 0;
const status = complete ? "completed" : "failed";
const callbackSecret = $env.PLATFORM_CALLBACK_SECRET;
if (!callbackSecret) throw new Error("Missing PLATFORM_CALLBACK_SECRET in n8n environment");
const timestamp = new Date().toISOString();
const nonce = "n8n_mcp_image_result_" + Date.now() + "_" + Math.random().toString(36).slice(2);
const files = complete ? urls.map((url, index) => ({
  file_id: String(waitInput.creation_id) + "_" + index,
  type: "image",
  url,
  source: "magnific-mcp",
  provider_creation_id: waitInput.creation_id
})) : [];
const callbackBody = {
  job_id: built.cp.job_id,
  correlation_id: built.cp.correlation_id,
  idempotency_key: built.cp.idempotency_key,
  workflow_type: "creative_image_generation",
  workflow_version: built.cp.workflow_version ?? "creative-image-mcp-v1",
  status,
  current_step: complete ? "Magnific MCP image is ready for review" : "Magnific MCP completed without a usable image URL",
  nonce,
  signature_timestamp: timestamp,
  signature: "",
  outputs: {
    provider: "magnific-mcp",
    mcp_endpoint: built.mcp_endpoint,
    creation_id: waitInput.creation_id,
    files,
    generation_result: waitInput.generation_result,
    wait_result: waitResult
  },
  files,
  warnings: [],
  error: complete ? undefined : { code: "MAGNIFIC_MCP_NO_IMAGE_URL", message: "Magnific MCP result did not include a usable image URL or image payload", retryable: true }
};
if (!callbackBody.error) delete callbackBody.error;
const raw = JSON.stringify(callbackBody);
const signature = crypto.createHmac("sha256", callbackSecret).update(timestamp + "." + nonce + "." + raw).digest("hex");
return [{ json: { callback_url: built.cp.callback_url, callback_headers: { signature, timestamp, nonce }, callback_body: callbackBody } }];`;

writeWorkflow(
  "10-creative-image-generation.json",
  "FF Admin - Creative Image Generation",
  [
    webhookNode("creative-image-webhook", "CP Creative Image Request Webhook", "future-foresight/creative-image-generation", [0, 0]),
    codeNode("validate-cp-request", "Validate Signed CP Request", validateCpRequest, [250, 0]),
    respondNode("respond-cp", "Acknowledge CP Request", [500, 0], '={{ { accepted: true, job_id: $json.cp.job_id, workflow_type: "creative_image_generation" } }}'),
    codeNode("build-magnific-mcp-request", "Build Magnific MCP Request", buildMagnificMcpRequest, [750, 0]),
    mcpClientNode("generate-image-with-magnific-mcp", "Generate Image With Magnific MCP", "images_generate", { prompt: "={{ $json.mcp_generate_args.prompt }}" }, [1000, 0]),
    codeNode("prepare-magnific-wait-input", "Prepare Magnific Wait Input", prepareMagnificWaitInput, [1250, 0]),
    mcpClientNode("wait-for-magnific-creation", "Wait For Magnific Creation", "creations_wait", { identifier: "={{ $json.mcp_wait_args.identifier }}" }, [1500, 0]),
    codeNode("prepare-completed-callback", "Prepare Completed CP Callback", prepareCompletedCallback, [1750, 0]),
    callbackNode("send-completed-callback", [2000, 0])
  ],
  {
    "CP Creative Image Request Webhook": { main: [[{ node: "Validate Signed CP Request", type: "main", index: 0 }]] },
    "Validate Signed CP Request": { main: [[{ node: "Acknowledge CP Request", type: "main", index: 0 }]] },
    "Acknowledge CP Request": { main: [[{ node: "Build Magnific MCP Request", type: "main", index: 0 }]] },
    "Build Magnific MCP Request": { main: [[{ node: "Generate Image With Magnific MCP", type: "main", index: 0 }]] },
    "Generate Image With Magnific MCP": { main: [[{ node: "Prepare Magnific Wait Input", type: "main", index: 0 }]] },
    "Prepare Magnific Wait Input": { main: [[{ node: "Wait For Magnific Creation", type: "main", index: 0 }]] },
    "Wait For Magnific Creation": { main: [[{ node: "Prepare Completed CP Callback", type: "main", index: 0 }]] },
    "Prepare Completed CP Callback": { main: [[{ node: "Send Signed Callback To CP", type: "main", index: 0 }]] }
  }
);

console.log("Built MCP-only creative image workflow.");
