import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  for (const envPath of [process.env.N8N_ENV_FILE, path.join(process.cwd(), "..", "1.env"), path.join(process.cwd(), "1.env")].filter(Boolean)) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index < 0) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
}
loadEnv();

const workflowName = "FF Admin - Creative Image Generation";
const baseUrl = process.env.N8N_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.N8N_API_KEY;
if (!baseUrl || !apiKey) throw new Error("Missing N8N_BASE_URL or N8N_API_KEY");

async function n8n(pathname, options = {}) {
  const response = await fetch(`${baseUrl}/api/v1${pathname}`, { ...options, headers: { "content-type": "application/json", "X-N8N-API-KEY": apiKey, ...(options.headers ?? {}) } });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`n8n ${options.method ?? "GET"} ${pathname} failed: ${response.status} ${text}`);
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
function forApi(workflow) {
  const settings = {};
  for (const key of ["executionOrder", "saveManualExecutions", "saveDataErrorExecution", "saveDataSuccessExecution"]) {
    if (workflow.settings?.[key] !== undefined) settings[key] = workflow.settings[key];
  }
  return { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings };
}

const summary = (await listWorkflows()).find((item) => item.name === workflowName);
if (!summary) throw new Error(`Workflow not found: ${workflowName}`);
const live = await n8n(`/workflows/${summary.id}`);
const generated = JSON.parse(fs.readFileSync(path.join(process.cwd(), "workflows", "n8n", "generated", "10-creative-image-generation.json"), "utf8"));
const generatedNode = generated.nodes.find((node) => node.name === "Build Magnific MCP Request");
const liveNode = live.nodes.find((node) => node.name === "Build Magnific MCP Request");
if (!generatedNode || !liveNode) throw new Error("Build Magnific MCP Request node missing");
liveNode.parameters.jsCode = generatedNode.parameters.jsCode;
for (const node of live.nodes.filter((entry) => entry.type === "@n8n/n8n-nodes-langchain.mcpClient")) {
  node.credentials = { mcpOAuth2Api: { id: "yZUlimcfhBdzy2Ba", name: "MCP account" } };
}
const backupDir = path.join(process.cwd(), "workflows", "n8n", "exports");
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `${stamp}-before-multi-product-image-fix.json`);
fs.writeFileSync(backupPath, `${JSON.stringify(live, null, 2)}\n`);
await n8n(`/workflows/${summary.id}`, { method: "PUT", body: JSON.stringify(forApi(live)) });
const verified = await n8n(`/workflows/${summary.id}`);
const code = verified.nodes.find((node) => node.name === "Build Magnific MCP Request")?.parameters?.jsCode ?? "";
if (!verified.active) throw new Error("Creative image workflow became inactive");
if (!code.includes("selected product itself is an edible oil") || code.includes("hero sunflower oil bottle")) throw new Error("Product-aware image prompt was not installed");
const credentialNodes = verified.nodes.filter((node) => node.type === "@n8n/n8n-nodes-langchain.mcpClient");
if (credentialNodes.some((node) => !node.credentials?.mcpOAuth2Api)) throw new Error("MCP OAuth credential binding was lost");
console.log(`Patched and verified active multi-product image workflow: ${summary.id}`);
console.log(`backup=${backupPath}`);