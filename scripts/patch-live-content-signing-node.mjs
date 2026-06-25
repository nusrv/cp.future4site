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
const backupPath = path.join(backupDir, `${stamp}-before-signing-node-fix.json`);
fs.writeFileSync(backupPath, `${JSON.stringify(live, null, 2)}\n`);

const node = live.nodes.find((entry) => entry.name === "Prepare Signed Content Callback");
if (!node) throw new Error("Prepare Signed Content Callback node not found.");
if (typeof node.parameters?.jsCode !== "string") throw new Error("Prepare Signed Content Callback jsCode not found.");

let code = node.parameters.jsCode;
if (!code.includes("globalThis.crypto.subtle")) {
  console.log("Node does not contain globalThis.crypto.subtle; no signing patch needed.");
  console.log(`backup=${backupPath}`);
  process.exit(0);
}

code = code.replace(
  "const secret = $env.PLATFORM_CALLBACK_SECRET;",
  'const crypto = require("crypto");\nconst secret = $env.PLATFORM_CALLBACK_SECRET;'
);

code = code.replace(
  /const encoder = new TextEncoder\(\);\s*const key = await globalThis\.crypto\.subtle\.importKey\([\s\S]*?const signature = Array\.from\(new Uint8Array\(signatureBuffer\)\)\.map\(\(byte\) => byte\.toString\(16\)\.padStart\(2, "0"\)\)\.join\(""\);/,
  'const signature = crypto.createHmac("sha256", secret).update(timestamp + "." + nonce + "." + raw).digest("hex");'
);

if (code.includes("globalThis.crypto.subtle")) {
  throw new Error("Signing patch failed; globalThis.crypto.subtle still present.");
}

node.parameters.jsCode = code;

const patched = await n8n(`/workflows/${summary.id}`, {
  method: "PUT",
  body: JSON.stringify(sanitizeForApi(live))
});

console.log(`Patched signing node in workflow: ${workflowName}`);
console.log(`id=${summary.id}`);
console.log(`wasActive=${summary.active}`);
console.log(`backup=${backupPath}`);
console.log(`updatedId=${patched.id ?? summary.id}`);
