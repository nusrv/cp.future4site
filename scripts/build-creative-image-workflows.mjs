import fs from "node:fs";
import path from "node:path";

const generatedDir = path.join(process.cwd(), "workflows", "n8n", "generated");
const codeDir = path.join(process.cwd(), "workflows", "n8n", "code");
const readCode = (name) => fs.readFileSync(path.join(codeDir, name), "utf8");
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
      tool: { __rl: true, mode: "list", value: tool, cachedResultName: tool },
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

const resolveBrandAssets = readCode("resolve-brand-assets.js");
const buildBackgroundPrompt = readCode("build-background-prompt.js");
const composeBrandImage = readCode("compose-brand-image.js");

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
const built = $("Build Background Prompt").item.json;
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
  mcp_wait_args: { identifiers: [creationId] }
} }];`;

const prepareCompletedCallback = `const crypto = require("crypto");
const item = $json;
const secret = $env.PLATFORM_CALLBACK_SECRET;
if (!secret) throw new Error("Missing PLATFORM_CALLBACK_SECRET in n8n environment");
const timestamp = new Date().toISOString();
const nonce = "n8n_composed_image_" + Date.now() + "_" + Math.random().toString(36).slice(2);
const file = {
  file_id: item.provider_creation_id + "_composed",
  type: "image",
  name: item.composed_file.name,
  mime_type: item.composed_file.mime_type,
  data_base64: item.composed_file.data_base64,
  size_bytes: item.composed_file.size_bytes,
  width: item.composed_file.width,
  height: item.composed_file.height,
  source: "n8n-sharp-compositor"
};
const callbackBody = {
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
  outputs: { provider: "magnific-background-plus-sharp", asset_contract: item.asset_contract, background_url: item.background_url, files: [{ ...file, data_base64: undefined }] },
  files: [file],
  warnings: []
};
delete callbackBody.outputs.files[0].data_base64;
const raw = JSON.stringify(callbackBody);
const signature = crypto.createHmac("sha256", secret).update(timestamp + "." + nonce + "." + raw).digest("hex");
return [{ json: { callback_url: item.cp.callback_url, callback_headers: { signature, timestamp, nonce }, callback_body: callbackBody } }];`;
writeWorkflow(
  "10-creative-image-generation.json",
  "FF Admin - Creative Image Generation",
  [
    webhookNode("creative-image-webhook", "CP Creative Image Request Webhook", "future-foresight/creative-image-generation", [0, 0]),
    codeNode("validate-cp-request", "Validate Signed CP Request", validateCpRequest, [250, 0]),
    respondNode("respond-cp", "Acknowledge CP Request", [500, 0], '={{ { accepted: true, job_id: $json.cp.job_id, workflow_type: "creative_image_generation" } }}'),
    codeNode("resolve-brand-assets", "Resolve Brand Assets", resolveBrandAssets, [750, 0]),
    codeNode("build-background-prompt", "Build Background Prompt", buildBackgroundPrompt, [1000, 0]),
    mcpClientNode("generate-image-with-magnific-mcp", "Generate Background With Magnific MCP", "images_generate", { prompt: "={{ $json.mcp_generate_args.prompt }}" }, [1250, 0]),
    codeNode("prepare-magnific-wait-input", "Prepare Magnific Wait Input", prepareMagnificWaitInput, [1500, 0]),
    mcpClientNode("wait-for-magnific-creation", "Wait For Magnific Creation", "creations_wait", { identifiers: "={{ $json.mcp_wait_args.identifiers }}" }, [1750, 0]),
    codeNode("compose-brand-image", "Compose Brand Image With Sharp", composeBrandImage, [2000, 0]),
    codeNode("prepare-completed-callback", "Prepare Completed CP Callback", prepareCompletedCallback, [2250, 0]),
    callbackNode("send-completed-callback", [2500, 0])
  ],
  {
    "CP Creative Image Request Webhook": { main: [[{ node: "Validate Signed CP Request", type: "main", index: 0 }]] },
    "Validate Signed CP Request": { main: [[{ node: "Acknowledge CP Request", type: "main", index: 0 }]] },
    "Acknowledge CP Request": { main: [[{ node: "Resolve Brand Assets", type: "main", index: 0 }]] },
    "Resolve Brand Assets": { main: [[{ node: "Build Background Prompt", type: "main", index: 0 }]] },
    "Build Background Prompt": { main: [[{ node: "Generate Background With Magnific MCP", type: "main", index: 0 }]] },
    "Generate Background With Magnific MCP": { main: [[{ node: "Prepare Magnific Wait Input", type: "main", index: 0 }]] },
    "Prepare Magnific Wait Input": { main: [[{ node: "Wait For Magnific Creation", type: "main", index: 0 }]] },
    "Wait For Magnific Creation": { main: [[{ node: "Compose Brand Image With Sharp", type: "main", index: 0 }]] },
    "Compose Brand Image With Sharp": { main: [[{ node: "Prepare Completed CP Callback", type: "main", index: 0 }]] },
    "Prepare Completed CP Callback": { main: [[{ node: "Send Signed Callback To CP", type: "main", index: 0 }]] }
  }
);

console.log("Built MCP-only creative image workflow.");
