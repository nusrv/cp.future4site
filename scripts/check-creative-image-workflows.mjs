import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "workflows", "n8n", "generated", "10-creative-image-generation.json");
const workflow = JSON.parse(fs.readFileSync(file, "utf8"));
const get = (name) => workflow.nodes.find((node) => node.name === name) ?? (() => { throw new Error(`Missing node: ${name}`); })();

const requiredNodes = [
  "Validate Signed CP Request",
  "Resolve Brand Assets",
  "Compose Brand Image With Sharp",
  "Prepare Completed CP Callback",
  "Send Signed Callback To CP"
];

const removedNodes = [
  "Build Background Prompt",
  "Generate Background With Magnific MCP",
  "Prepare Magnific Wait Input",
  "Wait For Magnific Creation"
];

for (const name of requiredNodes) get(name);

for (const name of removedNodes) {
  if (workflow.nodes.some((node) => node.name === name)) {
    throw new Error(`Magnific node must be removed from fixed-template workflow: ${name}`);
  }
}

const resolver = get("Resolve Brand Assets").parameters.jsCode;
const composer = get("Compose Brand Image With Sharp").parameters.jsCode;
const callback = get("Prepare Completed CP Callback").parameters.jsCode;

if (
  !resolver.includes("BRAND_ASSETS_BASE_DIR") ||
  !resolver.includes("approved_for_marketing") ||
  !resolver.includes("template_background_path") ||
  !resolver.includes("Fixed template background is unavailable") ||
  !resolver.includes("product_asset_ids") ||
  !resolver.includes("product_paths")
) {
  throw new Error("Brand resolver fixed-template/multi-product contract missing");
}

if (
  !composer.includes('require("sharp")') ||
  composer.includes('require("http")') ||
  composer.includes('require("https")') ||
  composer.includes("fetch(") ||
  !composer.includes("template_background_path") ||
  !composer.includes("Product image is required for fixed template composition") ||
  !composer.includes("image/jpeg") ||
  !composer.includes("maxCallbackImageBytes") ||
  !composer.includes("template_background_source") ||
  !composer.includes("composed_files") ||
  !composer.includes('mode: "separate-images"') ||
  !composer.includes("productPaths") ||
  !composer.includes("product_layout")
) {
  throw new Error("Sharp fixed-template composition contract missing");
}

if (
  composer.includes("logo_path") ||
  composer.includes("headline") ||
  composer.includes("cta") ||
  composer.includes("Request a Quote") ||
  composer.includes("textPanel")
) {
  throw new Error("Fixed-template composer must not add logo, headline, CTA, or text panel");
}

if (!composer.includes(".trim(") || !composer.includes("background: { r: 0, g: 0, b: 0, alpha: 0 }")) {
  throw new Error("Fixed-template composer must trim transparent product padding before resize");
}

if (composer.includes("(productFrame.h - productHeight) / 2")) {
  throw new Error("Fixed-template composer must bottom-align product, not vertically center it");
}

if (!callback.includes("n8n-sharp-compositor") || !callback.includes("data_base64") || !callback.includes("publicFiles") || !callback.includes("file_count")) {
  throw new Error("Composed callback contract missing");
}

if (workflow.active !== false) {
  throw new Error("Generated workflow must remain inactive until Sharp container preflight passes");
}

console.log(`Fixed-template Sharp creative workflow contract passed (${workflow.nodes.length} nodes).`);
