import fs from "node:fs";
import path from "node:path";

const generatedDir = path.join(process.cwd(), "workflows", "n8n", "generated");
const contentWorkflow = JSON.parse(fs.readFileSync(path.join(generatedDir, "01-content-request-intake-draft.json"), "utf8"));
const imageWorkflow = JSON.parse(fs.readFileSync(path.join(generatedDir, "10-creative-image-generation.json"), "utf8"));
const code = (workflow, name) => workflow.nodes.find((node) => node.name === name)?.parameters?.jsCode;
const run = (jsCode, globals) => Function(...Object.keys(globals), jsCode)(...Object.values(globals));

for (const product of ["Refined Sugar", "Steel Rebar"]) {
  const payload = { brand: "Future Foresight", product, topic: `${product} for importers`, market: "MENA", cta: "Request a Quote" };
  const builtText = run(code(contentWorkflow, "Build Approved Evidence And Prompt"), { $json: { cp: { payload } } })[0].json;
  if (!builtText.prompt.includes(product)) throw new Error(`Text prompt lost selected product: ${product}`);
  if (builtText.prohibited.some((rule) => /sugar or metals/i.test(rule))) throw new Error("Legacy category prohibition remains");
  const safeText = run(code(contentWorkflow, "Validate And Sanitize Output"), { $json: { ...builtText, generated_output: { headline: `${product} Supply`, caption: `Source ${product} for professional B2B requirements.`, cta: "Request a Quote", hashtags: ["#B2BTrade"], warnings: [] } } })[0].json.safe_output;
  if (!safeText.caption.includes(product)) throw new Error(`Validator rejected selected product: ${product}`);
  const builtImage = run(code(imageWorkflow, "Build Magnific MCP Request"), { $json: { cp: { payload } } })[0].json;
  const prompt = builtImage.mcp_generate_args.prompt;
  if (!prompt.includes(product)) throw new Error(`Image prompt lost selected product: ${product}`);
  if (/hero sunflower oil bottle|realistic golden oil cues/i.test(prompt)) throw new Error(`Oil-only imagery remains for ${product}`);
}
console.log("Multi-product text and image workflow tests passed for sugar and steel.");