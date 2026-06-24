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

const baseUrl = process.env.N8N_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.N8N_API_KEY;
if (!baseUrl || !apiKey) {
  console.error("Missing N8N_BASE_URL or N8N_API_KEY in environment.");
  process.exit(1);
}

async function n8n(pathname) {
  const response = await fetch(`${baseUrl}/api/v1${pathname}`, {
    headers: {
      "X-N8N-API-KEY": apiKey
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`n8n GET ${pathname} failed: ${response.status}`);
  return data;
}

const expectedNames = fs.readdirSync(path.join(process.cwd(), "workflows", "n8n", "generated"))
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "workflows", "n8n", "generated", file), "utf8")).name);

const all = [];
let cursor;
do {
  const result = await n8n(`/workflows${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
  all.push(...(result.data ?? []));
  cursor = result.nextCursor;
} while (cursor);

let failed = false;
for (const name of expectedNames) {
  const workflow = all.find((item) => item.name === name);
  if (!workflow) {
    console.error(`missing: ${name}`);
    failed = true;
    continue;
  }
  console.log(`${workflow.active ? "ACTIVE" : "inactive"}: ${workflow.name}`);
  if (workflow.active) failed = true;
}

if (failed) process.exit(1);
console.log(`Verified ${expectedNames.length} n8n workflows exist and are inactive.`);
