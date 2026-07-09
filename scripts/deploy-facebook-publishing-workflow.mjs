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

const activate = process.argv.includes("--activate");
const confirmLive = process.argv.includes("--confirm-live");
const confirmFacebookEnv = process.argv.includes("--confirm-facebook-env");
if (activate && (!confirmLive || !confirmFacebookEnv)) {
  throw new Error("Activation requires --activate --confirm-live --confirm-facebook-env after n8n has FUTURE_OILS_FACEBOOK_PAGE_ID and FUTURE_OILS_FACEBOOK_ACCESS_TOKEN configured");
}

const baseUrl = process.env.N8N_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.N8N_API_KEY;
if (!baseUrl || !apiKey) throw new Error("Missing N8N_BASE_URL or N8N_API_KEY");

const file = "13-facebook-publishing.json";
const name = "FF Admin - Facebook Publishing";
const workflowPath = path.join(process.cwd(), "workflows", "n8n", "generated", file);

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
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`n8n ${options.method ?? "GET"} ${pathname} failed: ${response.status} ${JSON.stringify(data)}`);
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
  const copy = structuredClone(workflow);
  for (const key of ["id", "versionId", "createdAt", "updatedAt", "shared", "active", "tags"]) delete copy[key];
  return copy;
}

const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
const existing = await listWorkflows();
const current = existing.find((item) => item.name === name);
let id;
if (current) {
  const updated = await n8n(`/workflows/${current.id}`, { method: "PUT", body: JSON.stringify(forApi(workflow)) });
  id = updated.id ?? current.id;
  console.log(`updated: ${name} (${id})`);
} else {
  const created = await n8n("/workflows", { method: "POST", body: JSON.stringify(forApi(workflow)) });
  id = created.id;
  console.log(`created: ${name} (${id})`);
}

if (activate) {
  await n8n(`/workflows/${id}/activate`, { method: "POST" });
  console.log(`activated: ${name} (${id})`);
}

const verified = await n8n(`/workflows/${id}`);
if (Boolean(verified.active) !== activate) throw new Error(`${name} active state mismatch`);
console.log(JSON.stringify({ activate, deployed: { id, name, active: verified.active, updatedAt: verified.updatedAt } }, null, 2));