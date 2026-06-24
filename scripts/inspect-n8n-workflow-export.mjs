import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/inspect-n8n-workflow-export.mjs <workflow-export.json>");
  process.exit(1);
}

const workflow = JSON.parse(fs.readFileSync(file, "utf8"));
console.log(`name=${workflow.name}`);
console.log(`active=${workflow.active}`);
console.log("nodes:");
for (const node of workflow.nodes ?? []) {
  console.log(`- ${node.name} | ${node.type} | id=${node.id} | disabled=${Boolean(node.disabled)} | position=${JSON.stringify(node.position)}`);
}
console.log("connections:");
console.log(JSON.stringify(workflow.connections, null, 2));
