import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/verify-production-generator-export.mjs <workflow-export.json>");
  process.exit(1);
}

const workflow = JSON.parse(fs.readFileSync(file, "utf8"));
const nodeNames = new Set(workflow.nodes.map((node) => node.name));

for (const required of [
  "Platform Content Request Webhook",
  "Capture And Validate CP Request",
  "Respond To Platform",
  "Build Approved Evidence And Prompt",
  "Production Content Generator",
  "OpenAI Chat Model - Configure Credential",
  "Normalize Generated Output",
  "Validate And Sanitize Output",
  "Prepare Signed Content Callback",
  "Send Signed Callback To CP"
]) {
  if (!nodeNames.has(required)) throw new Error(`Missing node: ${required}`);
}

for (const forbidden of [
  "Generate Text Output",
  "AI Agent",
  "Switch By LLM Provider"
]) {
  if (nodeNames.has(forbidden)) throw new Error(`Forbidden node still present: ${forbidden}`);
}

function assertMain(source, target) {
  const groups = workflow.connections[source]?.main ?? [];
  if (!groups.some((group) => group.some((connection) => connection.node === target))) {
    throw new Error(`Missing main connection: ${source} -> ${target}`);
  }
}

assertMain("Platform Content Request Webhook", "Capture And Validate CP Request");
assertMain("Capture And Validate CP Request", "Respond To Platform");
assertMain("Respond To Platform", "Build Approved Evidence And Prompt");
assertMain("Build Approved Evidence And Prompt", "Production Content Generator");
assertMain("Production Content Generator", "Normalize Generated Output");
assertMain("Normalize Generated Output", "Validate And Sanitize Output");
assertMain("Validate And Sanitize Output", "Prepare Signed Content Callback");
assertMain("Prepare Signed Content Callback", "Send Signed Callback To CP");

const modelConnections = workflow.connections["OpenAI Chat Model - Configure Credential"]?.ai_languageModel ?? [];
if (!modelConnections.some((group) => group.some((connection) => connection.node === "Production Content Generator"))) {
  throw new Error("Chat Model is not connected to Production Content Generator AI model input");
}

const sendNode = workflow.nodes.find((node) => node.name === "Send Signed Callback To CP");
if (sendNode.parameters.bodyParameters) throw new Error("Callback node still has bodyParameters");
if (sendNode.parameters.specifyBody !== "json") throw new Error("Callback node does not specify JSON body");
if (sendNode.parameters.jsonBody !== "={{ $json.callback_body }}") throw new Error("Callback node does not send callback_body directly");

console.log("Production generator workflow verification passed.");
console.log(`active=${workflow.active}`);
