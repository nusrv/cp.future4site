import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const baseUrl = process.env.N8N_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.N8N_API_KEY;
if (!baseUrl || !apiKey) {
  console.error("Missing N8N_BASE_URL or N8N_API_KEY in environment.");
  process.exit(1);
}

const workflowDir = path.join(process.cwd(), "workflows", "n8n", "generated");
const files = fs.readdirSync(workflowDir).filter((file) => file.endsWith(".json")).sort();

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
  const copy = JSON.parse(JSON.stringify(workflow));
  delete copy.id;
  delete copy.versionId;
  delete copy.createdAt;
  delete copy.updatedAt;
  delete copy.shared;
  delete copy.active;
  delete copy.tags;
  return copy;
}

const existing = await listWorkflows();
const byName = new Map(existing.map((workflow) => [workflow.name, workflow]));
const results = [];

for (const file of files) {
  const workflow = sanitizeForApi(JSON.parse(fs.readFileSync(path.join(workflowDir, file), "utf8")));
  const current = byName.get(workflow.name);
  if (current) {
    const updated = await n8n(`/workflows/${current.id}`, {
      method: "PUT",
      body: JSON.stringify(workflow)
    });
    results.push({ action: "updated", name: workflow.name, id: updated.id ?? current.id });
  } else {
    const created = await n8n("/workflows", {
      method: "POST",
      body: JSON.stringify(workflow)
    });
    results.push({ action: "created", name: workflow.name, id: created.id });
  }
}

for (const result of results) {
  console.log(`${result.action}: ${result.name} (${result.id})`);
}
console.log(`Pushed ${results.length} inactive draft workflows to n8n.`);
