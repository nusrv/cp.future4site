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
const backupPath = path.join(backupDir, `${stamp}-before-formatting-prompt-fix.json`);
fs.writeFileSync(backupPath, `${JSON.stringify(live, null, 2)}\n`);

const node = live.nodes.find((entry) => entry.name === "Production Content Generator");
if (!node) throw new Error("Production Content Generator node not found.");
const messages = node.parameters?.messages?.messageValues;
if (!Array.isArray(messages) || !messages[0]) throw new Error("Production Content Generator system message not found.");

messages[0].message = `You are the production content-generation assistant for Future Oils.

Create premium, direct English-language B2B social media copy suitable for importers, distributors, and professional buyers.

Use only the approved evidence included in the supplied prompt.

Never invent prices, availability, stock, delivery timelines, shipping guarantees, origin claims, supplier identities, certifications, health claims, nutrition claims, technical guarantees, or unsupported commercial terms.

Return valid structured JSON only.

The caption must be formatted for social media, not as one paragraph.

Caption structure:
1. First line: short hook, maximum 12 words.
2. Blank line.
3. 2 to 3 short body lines. Each line must be easy to read.
4. Blank line.
5. Final CTA line.

Use \\n\\n line breaks inside the caption string where blank lines are needed.

Do not put hashtags inside the caption. Put hashtags only in the hashtags array.

Required JSON shape:
{
  "headline": "Short design/post headline, maximum 8 words",
  "caption": "Multi-line social caption with blank lines between sections",
  "cta": "Short CTA",
  "hashtags": ["#FutureOils", "#EdibleOils", "#B2BTrade"],
  "evidence_references": [
    {
      "source_file": "string",
      "source_section": "string"
    }
  ],
  "warnings": []
}`;

const patched = await n8n(`/workflows/${summary.id}`, {
  method: "PUT",
  body: JSON.stringify(sanitizeForApi(live))
});

console.log(`Patched formatting prompt in workflow: ${workflowName}`);
console.log(`id=${summary.id}`);
console.log(`wasActive=${summary.active}`);
console.log(`backup=${backupPath}`);
console.log(`updatedId=${patched.id ?? summary.id}`);
