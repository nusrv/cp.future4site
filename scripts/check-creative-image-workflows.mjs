import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "workflows", "n8n", "generated");
const intake = JSON.parse(fs.readFileSync(path.join(dir, "10-creative-image-generation.json"), "utf8"));
const result = JSON.parse(fs.readFileSync(path.join(dir, "13-creative-image-result-callback.json"), "utf8"));

function node(workflow, name) {
  const found = workflow.nodes.find((item) => item.name === name);
  if (!found) throw new Error(`${workflow.name}: missing node ${name}`);
  return found;
}

for (const workflow of [intake, result]) {
  if (workflow.active !== false) throw new Error(`${workflow.name} export must remain inactive`);
  if (workflow.credentials || workflow.nodes.some((item) => item.credentials)) throw new Error(`${workflow.name} contains embedded credentials`);
}

if (node(intake, "CP Creative Image Request Webhook").parameters.path !== "future-foresight/creative-image-generation") throw new Error("Incorrect CP image webhook path");
const validationCode = node(intake, "Validate Signed CP Request").parameters.jsCode;
for (const required of ["N8N_WEBHOOK_SECRET", "timingSafeEqual", "creative_image_generation", "timestamp rejected"]) {
  if (!validationCode.includes(required)) throw new Error(`CP signature validation missing ${required}`);
}
const submission = node(intake, "Submit Mystic Image Generation");
if (submission.parameters.url !== "https://api.magnific.com/v1/ai/mystic") throw new Error("Incorrect Magnific Mystic endpoint");
const headers = submission.parameters.headerParameters.parameters;
const authHeader = headers.find((header) => header.name === "x-magnific-api-key");
if (!authHeader || authHeader.value !== "={{ $env.MAGNIFIC_TOKEN }}") throw new Error("Magnific token must come from n8n environment");
const requestCode = node(intake, "Build Magnific Request").parameters.jsCode;
if (!requestCode.includes("structure_reference") || !requestCode.includes("social_post_4_5") || !requestCode.includes("future-foresight/creative-image-result")) throw new Error("Magnific request is missing reference, aspect ratio, or result callback");
if (requestCode.length < 40000) throw new Error("Approved product reference was not embedded");

if (node(result, "Magnific Result Webhook").parameters.path !== "future-foresight/creative-image-result") throw new Error("Incorrect Magnific result webhook path");
const resultCode = node(result, "Verify Magnific And Prepare CP Callback").parameters.jsCode;
for (const required of ["MAGNIFIC_WEBHOOK_SECRET", "webhook-signature", "PLATFORM_CALLBACK_SECRET", "createHmac", "creative_image_generation", "has_nsfw"]) {
  if (!resultCode.includes(required)) throw new Error(`Result callback validation missing ${required}`);
}
for (const workflow of [intake, result]) node(workflow, "Send Signed Callback To CP");

console.log("Creative image workflow contract check passed.");
console.log(`intake_nodes=${intake.nodes.length}`);
console.log(`result_nodes=${result.nodes.length}`);