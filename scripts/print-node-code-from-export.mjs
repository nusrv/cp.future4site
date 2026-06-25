import fs from "node:fs";

const [file, ...nameParts] = process.argv.slice(2);
const nodeName = nameParts.join(" ");
if (!file || !nodeName) {
  console.error("Usage: node scripts/print-node-code-from-export.mjs <export-json> <node-name>");
  process.exit(1);
}

const workflow = JSON.parse(fs.readFileSync(file, "utf8"));
const node = workflow.nodes.find((entry) => entry.name === nodeName);
if (!node) {
  console.error(`Node not found: ${nodeName}`);
  process.exit(1);
}

console.log(`node=${node.name}`);
console.log(`type=${node.type}`);
console.log(node.parameters?.jsCode ?? JSON.stringify(node.parameters, null, 2));
