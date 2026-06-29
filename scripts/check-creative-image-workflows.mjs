import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "workflows", "n8n", "generated");
const intake = JSON.parse(fs.readFileSync(path.join(dir, "10-creative-image-generation.json"), "utf8"));
const obsoleteResultPath = path.join(dir, "13-creative-image-result-callback.json");
if (fs.existsSync(obsoleteResultPath)) throw new Error("Obsolete API/webhook result workflow must not be generated for MCP-only Magnific plans");

function node(workflow, name) {
  const found = workflow.nodes.find((item) => item.name === name);
  if (!found) throw new Error(`${workflow.name}: missing node ${name}`);
  return found;
}

if (intake.active !== false) throw new Error(`${intake.name} export must remain inactive`);
if (intake.credentials || intake.nodes.some((item) => item.credentials)) throw new Error(`${intake.name} contains embedded credentials`);
if (node(intake, "CP Creative Image Request Webhook").parameters.path !== "future-foresight/creative-image-generation") throw new Error("Incorrect CP image webhook path");

const validationCode = node(intake, "Validate Signed CP Request").parameters.jsCode;
for (const required of ["N8N_WEBHOOK_SECRET", "timingSafeEqual", "creative_image_generation", "timestamp rejected"]) {
  if (!validationCode.includes(required)) throw new Error(`CP signature validation missing ${required}`);
}

const buildCode = node(intake, "Build Magnific MCP Request").parameters.jsCode;
for (const required of ["https://mcp.magnific.com", "mcp_generate_args", "prompt", "4:5"]) {
  if (!buildCode.includes(required)) throw new Error(`MCP request builder missing ${required}`);
}

const generate = node(intake, "Generate Image With Magnific MCP");
if (generate.type !== "@n8n/n8n-nodes-langchain.mcpClient") throw new Error("Magnific generation must use the n8n MCP Client node");
if (generate.typeVersion !== 1) throw new Error("Magnific MCP node must use the schema exported by the live n8n instance");
if (generate.parameters.endpointUrl !== "https://mcp.magnific.com") throw new Error("Incorrect Magnific MCP endpoint");
if (generate.parameters.authentication !== "mcpOAuth2Api") throw new Error("Magnific MCP must use OAuth2 credentials");
if (generate.parameters.tool?.value !== "images_generate") throw new Error("Magnific MCP generation must call images_generate");
if (generate.parameters.parameters?.value?.prompt !== "={{ $json.mcp_generate_args.prompt }}") throw new Error("Magnific MCP generation prompt mapping is missing");
if (JSON.stringify(generate).includes("MAGNIFIC_TOKEN")) throw new Error("MCP workflow must not require MAGNIFIC_TOKEN");

const wait = node(intake, "Wait For Magnific Creation");
if (wait.type !== "@n8n/n8n-nodes-langchain.mcpClient") throw new Error("Magnific wait must use the n8n MCP Client node");
if (wait.typeVersion !== 1) throw new Error("Magnific MCP wait node must use the schema exported by the live n8n instance");
if (wait.parameters.endpointUrl !== "https://mcp.magnific.com") throw new Error("Incorrect Magnific MCP wait endpoint");
if (wait.parameters.authentication !== "mcpOAuth2Api") throw new Error("Magnific MCP wait must use OAuth2 credentials");
if (wait.parameters.tool?.value !== "creations_wait") throw new Error("Magnific MCP wait must call creations_wait");
const waitIdentifiers = wait.parameters.parameters?.value?.identifiers;
const hasWaitIdentifiersMapping =
  waitIdentifiers === "={{ $json.mcp_wait_args.identifiers }}" ||
  JSON.stringify(waitIdentifiers) === JSON.stringify(["={{ $json.mcp_wait_args.identifiers }}"]) ||
  JSON.stringify(waitIdentifiers) === JSON.stringify(["{{ $json.mcp_wait_args.identifiers }}"]) ||
  JSON.stringify(waitIdentifiers) === JSON.stringify(["{{ $json.creation_id }}"]);

if (!hasWaitIdentifiersMapping) {
  throw new Error("Magnific MCP wait identifiers mapping is missing");
}

const waitCode = node(intake, "Prepare Magnific Wait Input").parameters.jsCode;
for (const required of ["identifier", "creation_id", "task_id", "mcp_wait_args"]) {
  if (!waitCode.includes(required)) throw new Error(`Wait input mapper missing ${required}`);
}

const callbackCode = node(intake, "Prepare Completed CP Callback").parameters.jsCode;
for (const required of ["PLATFORM_CALLBACK_SECRET", "createHmac", "magnific-mcp", "files", "creative_image_generation"]) {
  if (!callbackCode.includes(required)) throw new Error(`Completed callback mapper missing ${required}`);
}
node(intake, "Send Signed Callback To CP");

console.log("MCP creative image workflow contract check passed.");
console.log(`intake_nodes=${intake.nodes.length}`);
