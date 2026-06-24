import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/verify-content-callback-node-export.mjs <export-json>");
  process.exit(1);
}

const workflow = JSON.parse(fs.readFileSync(file, "utf8"));
const prepareNode = workflow.nodes.find((node) => node.name === "Prepare Signed Content Callback");
const sendNode = workflow.nodes.find((node) => node.name === "Send Signed Callback To CP");

if (!prepareNode) throw new Error("Prepare Signed Content Callback not found");
if (!sendNode) throw new Error("Send Signed Callback To CP not found");
if (!prepareNode.parameters.jsCode.includes('workflow_version: body.workflow_version ?? "content-v1"')) {
  throw new Error("content-v1 fallback not found");
}
if (sendNode.parameters.bodyParameters) throw new Error("bodyParameters still exists on callback node");
if (sendNode.parameters.specifyBody !== "json") throw new Error("specifyBody is not json");
if (sendNode.parameters.jsonBody !== "={{ $json.callback_body }}") throw new Error("jsonBody is not direct callback_body expression");
if (sendNode.parameters.method !== "POST") throw new Error("method is not POST");
if (sendNode.parameters.url !== "={{ $json.callback_url }}") throw new Error("url is not callback_url expression");

const headers = sendNode.parameters.headerParameters?.parameters ?? [];
for (const name of ["content-type", "x-ff-signature", "x-ff-timestamp", "x-ff-nonce"]) {
  if (!headers.some((header) => header.name === name)) throw new Error(`missing header ${name}`);
}

console.log("Callback node export verification passed.");
console.log(`active=${workflow.active}`);
console.log(`node=${sendNode.name}`);
console.log(`jsonBody=${sendNode.parameters.jsonBody}`);
