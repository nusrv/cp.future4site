const sharp = require("sharp");
const fs = require("fs");
const http = require("http");
const https = require("https");
function parseMaybeJson(value) { if (typeof value !== "string") return value; try { return JSON.parse(value); } catch { return value; } }
function collectUrls(value, urls = new Set(), seen = new Set()) {
  const parsed = parseMaybeJson(value);
  if (!parsed || typeof parsed !== "object" || seen.has(parsed)) return urls;
  seen.add(parsed);
  if (Array.isArray(parsed)) { for (const item of parsed) collectUrls(item, urls, seen); return urls; }
  for (const [key, raw] of Object.entries(parsed)) {
    if (typeof raw === "string" && /^https?:\/\//.test(raw) && /url|image|download|web/i.test(key)) urls.add(raw);
    else collectUrls(raw, urls, seen);
  }
  return urls;
}
function escapeXml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]); }
function downloadBuffer(url, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error("Too many redirects while downloading Magnific background"));
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch (error) { reject(new Error("Invalid Magnific background URL")); return; }
    const client = parsed.protocol === "https:" ? https : parsed.protocol === "http:" ? http : null;
    if (!client) { reject(new Error("Unsupported Magnific background URL protocol")); return; }
    const request = client.get(parsed, (response) => {
      const status = response.statusCode || 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location) {
        response.resume();
        const nextUrl = new URL(location, parsed).toString();
        downloadBuffer(nextUrl, redirectCount + 1).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error("Could not download Magnific background: " + status));
        return;
      }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolve(Buffer.concat(chunks)));
    });
    request.setTimeout(60000, () => request.destroy(new Error("Timed out downloading Magnific background")));
    request.on("error", reject);
  });
}
const resolved = $("Resolve Brand Assets").item.json;
const waitInput = $("Prepare Magnific Wait Input").item.json;
const urls = [...collectUrls($json), ...collectUrls(waitInput.generation_result)];
const backgroundUrl = urls[0];
if (!backgroundUrl) throw new Error("Magnific result did not contain a background URL");
const background = await downloadBuffer(backgroundUrl);
const payload = resolved.cp.payload ?? {};
const contract = resolved.asset_contract;
const dimensions = { "4:5": [1080, 1350], "1:1": [1080, 1080], "9:16": [1080, 1920] }[contract.ratio];
const [width, height] = dimensions;
const theme = contract.brand_theme || {};
const colors = theme.colors || {};
const layout = contract.layout_rules || {};
const safeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
const clampNumber = (value, fallback, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const panelColor = safeColor(colors.panel, "#F8F4EA");
const headlineColor = safeColor(colors.headline, "#2B2B2B");
const ctaColor = safeColor(colors.cta_background, "#2E4A2E");
const ctaTextColor = safeColor(colors.cta_text, "#F8F4EA");
const logoWidthRatio = clampNumber(layout.logo_width_ratio, 0.22, 0.08, 0.4);
const productWidthRatio = clampNumber(layout.product_width_ratio, 0.46, 0.2, 0.7);
const productHeightRatio = clampNumber(layout.product_height_ratio, 0.68, 0.3, 0.85);
const logo = await sharp(fs.readFileSync(contract.logo_path)).resize({ width: Math.round(width * logoWidthRatio), withoutEnlargement: true }).png().toBuffer();
const composites = [{ input: logo, left: Math.round(width * 0.065), top: Math.round(height * 0.055) }];
if (contract.product_path) {
  const product = await sharp(fs.readFileSync(contract.product_path)).resize({ width: Math.round(width * productWidthRatio), height: Math.round(height * productHeightRatio), fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const meta = await sharp(product).metadata();
  composites.push({ input: product, left: width - (meta.width || 0) - Math.round(width * 0.055), top: height - (meta.height || 0) - Math.round(height * 0.045) });
}
const headline = escapeXml(String(payload.headline || "").slice(0, 90));
const cta = escapeXml(String(payload.cta || "").slice(0, 40));
const textSvg = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="${Math.round(width*0.055)}" y="${Math.round(height*0.23)}" width="${Math.round(width*0.55)}" height="${Math.round(height*0.34)}" rx="24" fill="${panelColor}" fill-opacity="0.90"/><text x="${Math.round(width*0.085)}" y="${Math.round(height*0.32)}" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="${headlineColor}"><tspan>${headline}</tspan></text><rect x="${Math.round(width*0.085)}" y="${Math.round(height*0.43)}" width="${Math.max(220, cta.length*24)}" height="74" rx="37" fill="${ctaColor}"/><text x="${Math.round(width*0.11)}" y="${Math.round(height*0.472)}" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="${ctaTextColor}">${cta}</text></svg>`);
composites.push({ input: textSvg, left: 0, top: 0 });
const finalBuffer = await sharp(background).resize(width, height, { fit: "cover" }).composite(composites).png({ compressionLevel: 9 }).toBuffer();
return [{ json: {
  cp: resolved.cp,
  asset_contract: contract,
  provider_creation_id: waitInput.creation_id,
  composed_file: { name: `creative-${resolved.cp.job_id}.png`, mime_type: "image/png", data_base64: finalBuffer.toString("base64"), size_bytes: finalBuffer.length, width, height },
  background_url: backgroundUrl
} }];