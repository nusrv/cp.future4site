import fs from "node:fs";
import path from "node:path";

const generatedDir = path.join(process.cwd(), "workflows", "n8n", "generated");
const codeDir = path.join(process.cwd(), "workflows", "n8n", "code");
const readCode = (name) => fs.readFileSync(path.join(codeDir, name), "utf8");
fs.mkdirSync(generatedDir, { recursive: true });

function codeNode(id, name, jsCode, position) {
  return { id, name, type: "n8n-nodes-base.code", typeVersion: 2, position, parameters: { jsCode } };
}

function webhookNode(id, name, webhookPath, position) {
  return {
    id,
    name,
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position,
    parameters: {
      path: webhookPath,
      httpMethod: "POST",
      responseMode: "responseNode",
      options: {}
    }
  };
}

function respondNode(id, name, position, responseBody) {
  return {
    id,
    name,
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1,
    position,
    parameters: { respondWith: "json", responseBody, options: {} }
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
    settings: {
      executionOrder: "v1",
      saveManualExecutions: true,
      saveDataErrorExecution: "all",
      saveDataSuccessExecution: "all"
    },
    tags: ["future-foresight", "creative-image", "fixed-template-sharp"]
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
const composeBrandImage = readCode("compose-brand-image.js");
const prepareCompletedCallback = readCode("prepare-completed-callback.js");

writeWorkflow(
  "10-creative-image-generation.json",
  "FF Admin - Creative Image Generation",
  [
    webhookNode("creative-image-webhook", "CP Creative Image Request Webhook", "future-foresight/creative-image-generation", [0, 0]),
    codeNode("validate-cp-request", "Validate Signed CP Request", validateCpRequest, [250, 0]),
    respondNode("respond-cp", "Acknowledge CP Request", [500, 0], '={{ { accepted: true, job_id: $json.cp.job_id, workflow_type: "creative_image_generation" } }}'),
    codeNode("resolve-brand-assets", "Resolve Brand Assets", resolveBrandAssets, [750, 0]),
    codeNode("compose-brand-image", "Compose Brand Image With Sharp", composeBrandImage, [1000, 0]),
    codeNode("prepare-completed-callback", "Prepare Completed CP Callback", prepareCompletedCallback, [1250, 0]),
    callbackNode("send-completed-callback", [1500, 0])
  ],
  {
    "CP Creative Image Request Webhook": { main: [[{ node: "Validate Signed CP Request", type: "main", index: 0 }]] },
    "Validate Signed CP Request": { main: [[{ node: "Acknowledge CP Request", type: "main", index: 0 }]] },
    "Acknowledge CP Request": { main: [[{ node: "Resolve Brand Assets", type: "main", index: 0 }]] },
    "Resolve Brand Assets": { main: [[{ node: "Compose Brand Image With Sharp", type: "main", index: 0 }]] },
    "Compose Brand Image With Sharp": { main: [[{ node: "Prepare Completed CP Callback", type: "main", index: 0 }]] },
    "Prepare Completed CP Callback": { main: [[{ node: "Send Signed Callback To CP", type: "main", index: 0 }]] }
  }
);

console.log("Built fixed-template Sharp creative image workflow.");
