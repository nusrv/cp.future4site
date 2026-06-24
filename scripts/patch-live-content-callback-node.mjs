import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const envPaths = [
    process.env.N8N_ENV_FILE,
    path.join(process.cwd(), "..", ".env"),
    path.join(process.cwd(), ".env")
  ].filter(Boolean);

  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnv();

const workflowName = "FF Admin - Content Request Intake - Draft";
const baseUrl = process.env.N8N_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.N8N_API_KEY;

if (!baseUrl || !apiKey) {
  console.error("Missing N8N_BASE_URL or N8N_API_KEY.");
  process.exit(1);
}

async function n8n(pathname, options = {}) {
  const response = await fetch(`${baseUrl}/api/v1${pathname}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "X-N8N-API-KEY": apiKey,
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`n8n ${options.method ?? "GET"} ${pathname} failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function listWorkflows() {
  const all = [];
  let cursor;
  do {
    const result = await n8n(`/workflows${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    all.push(...(result.data ?? []));
    cursor = result.nextCursor;
  } while (cursor);
  return all;
}

function sanitizeForApi(workflow) {
  const settings = {};
  for (const key of ["executionOrder", "saveManualExecutions", "saveDataErrorExecution", "saveDataSuccessExecution"]) {
    if (workflow.settings && workflow.settings[key] !== undefined) settings[key] = workflow.settings[key];
  }
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings
  };
}

const workflows = await listWorkflows();
const summary = workflows.find((workflow) => workflow.name === workflowName);
if (!summary) throw new Error(`Workflow not found: ${workflowName}`);

const live = await n8n(`/workflows/${summary.id}`);
const backupDir = path.join(process.cwd(), "workflows", "n8n", "exports");
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `${stamp}-before-callback-node-fix.json`);
fs.writeFileSync(backupPath, `${JSON.stringify(live, null, 2)}\n`);

const prepareNode = live.nodes.find((node) => node.name === "Prepare Signed Content Callback");
if (!prepareNode) throw new Error("Prepare Signed Content Callback node not found.");
if (typeof prepareNode.parameters?.jsCode !== "string") throw new Error("Prepare node jsCode not found.");

prepareNode.parameters.jsCode = prepareNode.parameters.jsCode.replace(
  'workflow_version: body.workflow_version ?? "mock-v1"',
  'workflow_version: body.workflow_version ?? "content-v1"'
);

const sendNode = live.nodes.find((node) => node.name === "Send Signed Callback To CP");
if (!sendNode) throw new Error("Send Signed Callback To CP node not found.");

sendNode.id = "send-callback";
sendNode.type = "n8n-nodes-base.httpRequest";
sendNode.typeVersion = 4;
sendNode.position = [1824, 0];
sendNode.notes = "Sends the signed generated content callback to the CP platform.";
sendNode.parameters = {
  method: "POST",
  url: "={{ $json.callback_url }}",
  sendHeaders: true,
  headerParameters: {
    parameters: [
      {
        name: "content-type",
        value: "application/json"
      },
      {
        name: "x-ff-signature",
        value: "={{ $json.callback_headers.signature }}"
      },
      {
        name: "x-ff-timestamp",
        value: "={{ $json.callback_headers.timestamp }}"
      },
      {
        name: "x-ff-nonce",
        value: "={{ $json.callback_headers.nonce }}"
      }
    ]
  },
  sendBody: true,
  specifyBody: "json",
  jsonBody: "={{ $json.callback_body }}",
  options: {}
};

const patched = await n8n(`/workflows/${summary.id}`, {
  method: "PUT",
  body: JSON.stringify(sanitizeForApi(live))
});

console.log(`Patched workflow: ${workflowName}`);
console.log(`id=${summary.id}`);
console.log(`wasActive=${summary.active}`);
console.log(`backup=${backupPath}`);
console.log(`updatedId=${patched.id ?? summary.id}`);
