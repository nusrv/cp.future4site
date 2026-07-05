import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  for (const envPath of [process.env.N8N_ENV_FILE, path.join(process.cwd(), "..", ".env"), path.join(process.cwd(), ".env")].filter(Boolean)) {
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

const workflowName = "FF Admin - Content Request Intake - Draft";
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
const generated = JSON.parse(fs.readFileSync(path.join(process.cwd(), "workflows", "n8n", "generated", "01-content-request-intake-draft.json"), "utf8"));
const generatedNode = (name) => generated.nodes.find((node) => node.name === name) ?? (() => { throw new Error(`Generated node missing: ${name}`); })();
const liveNode = (name) => live.nodes.find((node) => node.name === name) ?? (() => { throw new Error(`Live node missing: ${name}`); })();

for (const name of ["Build Approved Evidence And Prompt", "Validate And Sanitize Output"]) {
  liveNode(name).parameters.jsCode = generatedNode(name).parameters.jsCode;
}

liveNode("Normalize Generated Output").parameters.jsCode = `const original = $("Build Approved Evidence And Prompt").first().json;
function deterministicFallback(reason) {
  const payload = original.payload ?? {};
  const evidence = original.evidence ?? [];
  const product = String(payload.product || "the selected product");
  const brand = String(payload.brand || "Future Foresight");
  return {
    headline: String(payload.topic || product + " for B2B Buyers").slice(0, 120),
    caption: [
      brand + " supports B2B enquiries for " + product + ".",
      "Share your requirements through the official inquiry process so the team can review the product, target market, and requested terms.",
      "Request a Quote"
    ].join("\\n\\n"),
    cta: payload.cta || "Request a Quote",
    hashtags: ["#FutureForesight", "#B2BTrade"],
    evidence_references: evidence.map((entry) => ({ source_file: entry.source_file, source_section: entry.source_section })),
    warnings: [reason]
  };
}
const hasError = Boolean($json.error || $json.message?.toLowerCase?.().includes("error"));
let generated = $json.output ?? $json.text ?? $json.response ?? $json;
if (hasError) generated = deterministicFallback("The configured production Chat Model was unavailable; deterministic safe content was returned.");
else if (typeof generated === "string") {
  const fence = String.fromCharCode(96, 96, 96);
  let cleaned = generated.trim();
  if (cleaned.startsWith(fence)) cleaned = cleaned.replace(new RegExp("^" + fence + "[a-zA-Z]*\\\\s*"), "").replace(new RegExp(fence + "$"), "").trim();
  try { generated = JSON.parse(cleaned); }
  catch { generated = deterministicFallback("The configured production Chat Model returned non-JSON output; deterministic safe content was returned."); }
}
return [{ json: { ...original, generated_output: generated } }];`;

const messages = liveNode("Production Content Generator").parameters?.messages?.messageValues;
if (!Array.isArray(messages) || !messages[0]) throw new Error("Production generator system message missing");
messages[0].message = `You create premium, direct English-language B2B social media copy for the brand and product supplied in the content request.

The selected product is authoritative. Write specifically about it. Never refuse sugar, steel, metals, edible oils, or another legitimate commodity merely because of its category. Never substitute edible oil or another product for the selected product.

Use only approved evidence in the supplied prompt. Never invent prices, availability, stock, delivery timelines, shipping guarantees, origin claims, supplier identities, certifications, health or nutrition claims, grades, specifications, packaging, standards, technical guarantees, or unsupported commercial terms.

Return valid structured JSON only. Format the caption with a short hook, blank line, 2 to 3 short body lines, blank line, and final CTA. Put hashtags only in the hashtags array.`;

const backupDir = path.join(process.cwd(), "workflows", "n8n", "exports");
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `${stamp}-before-multi-product-content-fix.json`);
fs.writeFileSync(backupPath, `${JSON.stringify(live, null, 2)}\n`);
await n8n(`/workflows/${summary.id}`, { method: "PUT", body: JSON.stringify(forApi(live)) });
const verified = await n8n(`/workflows/${summary.id}`);
const joined = JSON.stringify(verified.nodes);
if (!verified.active) throw new Error("Content workflow became inactive");
if (joined.includes("Non-edible-oil category detected") || joined.includes('"sugar or metals"')) throw new Error("Oil-only restrictions remain in live workflow");
if (!joined.includes("selected product is authoritative")) throw new Error("Product-aware instruction missing after update");
console.log(`Patched and verified active multi-product content workflow: ${summary.id}`);
console.log(`backup=${backupPath}`);