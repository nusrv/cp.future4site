const item = $json;
const payload = item.cp.payload ?? {};
const product = String(payload.product ?? "the selected product").trim();
const market = String(payload.market ?? "international B2B buyers").trim();
const visualDirection = String(payload.visual_direction ?? "premium clean B2B commercial background with bright neutral lighting").trim();
const prompt = [
  "Create a background scene only for a professional B2B social creative.",
  "Product category context: " + product + ". Target market: " + market + ".",
  "Visual direction: " + visualDirection + ".",
  "Use a portrait commercial composition with clean depth, realistic lighting, and generous negative space.",
  "Do not show any product, package, bottle, container, commodity pile, logo, emblem, brand mark, typography, headline, CTA, badge, certification, watermark, person, or hand.",
  "The final result must be a clean background plate. Exact product, logo, and text will be composited later."
].join(" ");
return [{ json: { ...item, mcp_generate_args: { prompt }, requested_output: { type: "background", aspect_ratio: item.asset_contract.ratio, review_required: true } } }];