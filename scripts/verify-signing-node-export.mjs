import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/verify-signing-node-export.mjs <workflow-export.json>");
  process.exit(1);
}

const workflow = JSON.parse(fs.readFileSync(file, "utf8"));
const node = workflow.nodes.find((entry) => entry.name === "Prepare Signed Content Callback");
if (!node) throw new Error("Prepare Signed Content Callback node not found");
const code = node.parameters?.jsCode ?? "";

if (code.includes("globalThis.crypto.subtle")) throw new Error("globalThis.crypto.subtle still present");
if (!code.includes('require("crypto")')) throw new Error('require("crypto") not present');
if (!code.includes("createHmac")) throw new Error("createHmac not present");

console.log("Signing node verification passed.");
console.log(`active=${workflow.active}`);
