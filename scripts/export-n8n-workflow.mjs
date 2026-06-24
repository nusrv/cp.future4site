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

const workflowName = process.argv.slice(2).join(" ") || "FF Admin - Content Request Intake - Draft";
const baseUrl = process.env.N8N_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.N8N_API_KEY;
if (!baseUrl || !apiKey) {
  console.error("Missing N8N_BASE_URL or N8N_API_KEY.");
  process.exit(1);
}

async function n8n(pathname) {
  const response = await fetch(`${baseUrl}/api/v1${pathname}`, {
    headers: { "X-N8N-API-KEY": apiKey }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`n8n GET ${pathname} failed: ${response.status} ${JSON.stringify(data)}`);
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

const workflows = await listWorkflows();
const workflow = workflows.find((item) => item.name === workflowName);
if (!workflow) {
  console.error(`Workflow not found: ${workflowName}`);
  process.exit(1);
}

const full = await n8n(`/workflows/${workflow.id}`);
const outDir = path.join(process.cwd(), "workflows", "n8n", "exports");
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const safeName = workflowName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const outPath = path.join(outDir, `${stamp}-${safeName}.json`);
fs.writeFileSync(outPath, `${JSON.stringify(full, null, 2)}\n`);

console.log(`Exported ${workflowName}`);
console.log(`id=${workflow.id}`);
console.log(`active=${workflow.active}`);
console.log(`path=${outPath}`);

