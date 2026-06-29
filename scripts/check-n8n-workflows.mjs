import fs from "node:fs";
import path from "node:path";

const dirs = [
  path.join(process.cwd(), "workflows", "n8n"),
  path.join(process.cwd(), "workflows", "n8n", "generated")
].filter((dir) => fs.existsSync(dir));

for (const dir of dirs) {
  for (const file of fs.readdirSync(dir).filter((entry) => entry.endsWith(".json"))) {
    const workflow = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const serialized = JSON.stringify(workflow);
    if (workflow.active !== false) throw new Error(`${file} must remain inactive`);
    if (workflow.credentials) throw new Error(`${file} contains workflow credentials`);
    if ((workflow.nodes ?? []).some((node) => node.credentials)) throw new Error(`${file} contains node credentials`);
    const secretScanText = serialized.replace(/x-magnific-api-key|MAGNIFIC_TOKEN/gi, "");
    if (/access_token|api[_-]?key|password/i.test(secretScanText)) throw new Error(`${file} contains secret-like text`);
  }
}

console.log("n8n workflow safety check passed.");

