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

function allowedSettings(settings = {}) {
  const out = {};
  for (const key of ["executionOrder", "saveManualExecutions", "saveDataErrorExecution", "saveDataSuccessExecution"]) {
    if (settings[key] !== undefined) out[key] = settings[key];
  }
  return out;
}

function sanitizeForApi(workflow) {
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: allowedSettings(workflow.settings)
  };
}

function stripNode(workflow, names) {
  const remove = new Set(names);
  workflow.nodes = workflow.nodes.filter((node) => !remove.has(node.name));

  for (const source of Object.keys(workflow.connections ?? {})) {
    if (remove.has(source)) {
      delete workflow.connections[source];
      continue;
    }
    for (const channel of Object.keys(workflow.connections[source] ?? {})) {
      workflow.connections[source][channel] = (workflow.connections[source][channel] ?? []).map((group) =>
        group.filter((connection) => !remove.has(connection.node))
      );
    }
  }
}

const workflows = await listWorkflows();
const summary = workflows.find((workflow) => workflow.name === workflowName);
if (!summary) throw new Error(`Workflow not found: ${workflowName}`);

const live = await n8n(`/workflows/${summary.id}`);
const backupDir = path.join(process.cwd(), "workflows", "n8n", "exports");
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `${stamp}-before-production-generator-patch.json`);
fs.writeFileSync(backupPath, `${JSON.stringify(live, null, 2)}\n`);

if (summary.active) {
  await n8n(`/workflows/${summary.id}/deactivate`, { method: "POST" });
}

const required = [
  "Platform Content Request Webhook",
  "Capture And Validate CP Request",
  "Respond To Platform",
  "Build Approved Evidence And Prompt",
  "Validate And Sanitize Output",
  "Prepare Signed Content Callback",
  "Send Signed Callback To CP"
];

for (const name of required) {
  if (!live.nodes.some((node) => node.name === name)) throw new Error(`Required node missing: ${name}`);
}

stripNode(live, [
  "Generate Text Output",
  "Production Content Generator",
  "Normalize Generated Output",
  "OpenAI Chat Model - Configure Credential",
  "AI Agent",
  "Switch By LLM Provider"
]);

const productionNode = {
  id: "production-content-generator",
  name: "Production Content Generator",
  type: "@n8n/n8n-nodes-langchain.chainLlm",
  typeVersion: 1.6,
  position: [1040, 0],
  continueOnFail: true,
  parameters: {
    promptType: "define",
    text: "={{ $json.prompt }}",
    messages: {
      messageValues: [
        {
          message: "You are the production content-generation assistant for Future Oils.\n\nCreate premium, direct English-language B2B social media copy suitable for importers, distributors, and professional buyers.\n\nUse only the approved evidence included in the supplied prompt.\n\nNever invent prices, availability, stock, delivery timelines, shipping guarantees, origin claims, supplier identities, certifications, health claims, nutrition claims, technical guarantees, or unsupported commercial terms.\n\nReturn valid structured JSON only with these fields: headline, caption, cta, hashtags, evidence_references, warnings."
        }
      ]
    }
  },
  notes: "Provider-agnostic production generation node. Connect exactly one native n8n Chat Model to this node's AI model input."
};

const chatModelNode = {
  id: "configure-chat-model",
  name: "OpenAI Chat Model - Configure Credential",
  type: "@n8n/n8n-nodes-langchain.lmChatOpenAi",
  typeVersion: 1.2,
  position: [1040, 240],
  parameters: {
    model: {
      __rl: true,
      mode: "list",
      value: "gpt-4o-mini"
    },
    options: {}
  },
  notes: "Configure this native Chat Model credential/model in n8n. It may later be replaced with Anthropic, Gemini, Ollama, or another supported Chat Model without changing CP or JavaScript."
};

const normalizeNode = {
  id: "normalize-generated-output",
  name: "Normalize Generated Output",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [1184, 0],
  parameters: {
    jsCode: `
const original = $("Build Approved Evidence And Prompt").first().json;

function deterministicFallback(reason) {
  const payload = original.payload ?? {};
  const evidence = original.evidence ?? [];
  const product = payload.product ? String(payload.product) : "edible oils";
  return {
    headline: String(payload.topic || "Future Oils for B2B Buyers").slice(0, 120),
    caption: [
      "Future Oils supports B2B enquiries for " + product + ".",
      "Share your request through the official inquiry process so the team can review product, format, market, and contact details.",
      "Approved formats: 1L, 2L, 4L, 5L, 10L, 18L, 20L, and Flexitank.",
      "Request a Quote"
    ].join("\\n\\n"),
    cta: payload.cta || "Request a Quote",
    hashtags: ["#FutureOils", "#EdibleOils", "#B2BTrade"],
    evidence_references: evidence.map((entry) => ({
      source_file: entry.source_file,
      source_section: entry.source_section
    })),
    warnings: [reason]
  };
}

const hasError = Boolean($json.error || $json.message?.toLowerCase?.().includes("error"));
let generated = $json.output ?? $json.text ?? $json.response ?? $json;

if (hasError) {
  generated = deterministicFallback("The configured production Chat Model was unavailable; deterministic safe content was returned.");
} else if (typeof generated === "string") {
  const fence = String.fromCharCode(96, 96, 96);
  let cleaned = generated.trim();
  if (cleaned.startsWith(fence)) {
    cleaned = cleaned
      .replace(new RegExp("^" + fence + "[a-zA-Z]*\\\\s*"), "")
      .replace(new RegExp(fence + "$"), "")
      .trim();
  }
  try {
    generated = JSON.parse(cleaned);
  } catch (error) {
    generated = deterministicFallback("The configured production Chat Model returned non-JSON output; deterministic safe content was returned.");
  }
}

return [{
  json: {
    ...original,
    generated_output: generated
  }
}];
`.trim()
  },
  notes: "Normalizes the native LLM Chain output while preserving cp, payload, evidence, prohibited, and prompt."
};

live.nodes.push(productionNode, chatModelNode, normalizeNode);

live.connections = live.connections ?? {};
live.connections["Build Approved Evidence And Prompt"] = {
  main: [[{ node: "Production Content Generator", type: "main", index: 0 }]]
};
live.connections["Production Content Generator"] = {
  main: [[{ node: "Normalize Generated Output", type: "main", index: 0 }]]
};
live.connections["Normalize Generated Output"] = {
  main: [[{ node: "Validate And Sanitize Output", type: "main", index: 0 }]]
};
live.connections["OpenAI Chat Model - Configure Credential"] = {
  ai_languageModel: [[{ node: "Production Content Generator", type: "ai_languageModel", index: 0 }]]
};

const patched = await n8n(`/workflows/${summary.id}`, {
  method: "PUT",
  body: JSON.stringify(sanitizeForApi(live))
});

console.log(`Patched workflow: ${workflowName}`);
console.log(`id=${summary.id}`);
console.log(`wasActive=${summary.active}`);
console.log("active=false");
console.log(`backup=${backupPath}`);
console.log(`updatedId=${patched.id ?? summary.id}`);
