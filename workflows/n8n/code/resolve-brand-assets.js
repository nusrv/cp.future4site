const fs = require("fs");
const path = require("path");
const cp = $json.cp;
const payload = cp.payload ?? {};
const baseDir = path.resolve(String($env.BRAND_ASSETS_BASE_DIR || "/data/brand-assets"));
const idPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const brandId = String(payload.brand_id || "future-oils");
const logoId = String(payload.logo_id || "primary");
function inferProductAssetId(payload) {
  if (payload.product_asset_id) return String(payload.product_asset_id);
  const product = String(payload.product || "").toLowerCase().replace(/\s+/g, "");
  if (!product.includes("sunflower") && !product.includes("refinedoil") && !product.includes("refinedsunfloweroil")) return null;
  for (const size of ["18l", "10l", "5l", "4l", "1l"]) {
    if (product.includes(size)) return `sunflower-oil-${size}`;
  }
  return "sunflower-oil-10l";
}
const productAssetId = inferProductAssetId(payload);
const ratio = String(payload.ratio || "4:5");
if (!idPattern.test(brandId) || !idPattern.test(logoId) || (productAssetId && !idPattern.test(productAssetId))) throw new Error("Invalid brand asset identifier");
if (!new Set(["4:5", "1:1", "9:16"]).has(ratio)) throw new Error("Unsupported creative ratio");
const profilePath = path.resolve(baseDir, "brand-profile.json");
if (!profilePath.startsWith(baseDir + path.sep)) throw new Error("Brand profile path escaped asset root");
const profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
if (profile.brand_id !== brandId) throw new Error("Requested brand profile is unavailable");
function resolveAsset(relative) {
  if (!relative || typeof relative !== "string") throw new Error("Brand asset is missing from profile");
  const absolute = path.resolve(baseDir, relative);
  if (!absolute.startsWith(baseDir + path.sep)) throw new Error("Brand asset path escaped asset root");
  if (!fs.statSync(absolute).isFile()) throw new Error("Brand asset file is unavailable");
  return absolute;
}
const logoRelative = profile.logos?.[logoId];
const product = productAssetId ? profile.products?.[productAssetId] : null;
if (productAssetId && !product) throw new Error("Requested product asset is unavailable");
if (product && product.approved_for_marketing !== true) throw new Error(product.restriction || "Requested product asset is not approved for marketing");
return [{ json: {
  cp,
  asset_contract: {
    brand_id: brandId,
    logo_id: logoId,
    product_asset_id: productAssetId,
    ratio,
    profile_version: profile.schema_version,
    brand_theme: profile.brand_theme || {},
    layout_rules: profile.layout_rules || {},
    logo_path: resolveAsset(logoRelative),
    product_path: product ? resolveAsset(product.file) : null
  }
} }];