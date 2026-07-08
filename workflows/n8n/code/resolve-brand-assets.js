const fs = require("fs");
const path = require("path");

const cp = $json.cp;
const payload = cp.payload ?? {};

const baseDir = path.resolve(String($env.BRAND_ASSETS_BASE_DIR || "/data/brand-assets"));

const idPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;

const brandId = String(payload.brand_id || "future-oils");
const logoId = String(payload.logo_id || "primary");
const ratio = String(payload.ratio || "4:5");

if (!idPattern.test(brandId) || !idPattern.test(logoId)) {
  throw new Error("Invalid brand asset identifier");
}

if (!new Set(["4:5", "1:1", "9:16"]).has(ratio)) {
  throw new Error("Unsupported creative ratio");
}

const profilePath = path.resolve(baseDir, "brand-profile.json");

if (!profilePath.startsWith(baseDir + path.sep)) {
  throw new Error("Brand profile path escaped asset root");
}

const profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

if (profile.brand_id !== brandId) {
  throw new Error("Requested brand profile is unavailable");
}

function resolveAsset(relative) {
  if (!relative || typeof relative !== "string") {
    throw new Error("Brand asset is missing from profile");
  }

  const absolute = path.resolve(baseDir, relative);

  if (!absolute.startsWith(baseDir + path.sep)) {
    throw new Error("Brand asset path escaped asset root");
  }

  if (!fs.statSync(absolute).isFile()) {
    throw new Error("Brand asset file is unavailable: " + absolute);
  }

  return absolute;
}

function normalizeArabicDigits(value) {
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const easternArabicIndic = "۰۱۲۳۴۵۶۷۸۹";

  return String(value || "").replace(/[٠-٩۰-۹]/g, (digit) => {
    const a = arabicIndic.indexOf(digit);
    if (a >= 0) return String(a);

    const e = easternArabicIndic.indexOf(digit);
    if (e >= 0) return String(e);

    return digit;
  });
}

function normalizeText(value) {
  return normalizeArabicDigits(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[._/\\]+/g, " ")
    .replace(/[-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function getPayloadSearchText(payload) {
  return [
    payload.product_asset_id,
    payload.product_key,
    payload.product_code,
    payload.product_id,
    payload.sku,
    payload.product_sku,
    payload.product,
    payload.product_name,
    payload.title,
    payload.headline,
    payload.description,
    payload.size,
    payload.capacity,
    payload.volume,
    payload.package_size,
    payload.pack_size
  ]
    .filter((value) => value !== null && value !== undefined && String(value).trim())
    .map(String)
    .join(" ");
}

/**
 * Extract liter capacity from payload.
 * Supports:
 * 5L
 * 5 L
 * 5-liter
 * 5 liter
 * 5 litres
 * 5 ltr
 * 5 لتر
 * ٥ لتر
 */
function extractCapacityLiters(payload) {
  const explicitFields = [
    payload.capacity_liters,
    payload.capacity_litre,
    payload.volume_liters,
    payload.volume_litre,
    payload.liters,
    payload.litres,
    payload.size_liters,
    payload.size_litre,
    payload.pack_size_liters,
    payload.pack_size_litre
  ];

  for (const value of explicitFields) {
    const number = Number(normalizeArabicDigits(value));

    if (Number.isFinite(number) && number > 0 && number <= 100) {
      return number;
    }
  }

  const text = normalizeText(getPayloadSearchText(payload));

  const patterns = [
    /(?:^|\D)(\d+(?:\.\d+)?)\s*(?:l|lt|ltr|liter|liters|litre|litres|لتر|ليتر)(?:\D|$)/i,
    /(?:^|\D)(\d+(?:\.\d+)?)\s*[- ]?\s*(?:l|lt|ltr)(?:\D|$)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      const number = Number(match[1]);

      if (Number.isFinite(number) && number > 0 && number <= 100) {
        return number;
      }
    }
  }

  /**
   * Fallback:
   * لو لم نجد وحدة L/لتر، نبحث عن رقم واضح من السعات المعروفة.
   * رتبنا 18 و13 و12 و10 قبل 1 و2 حتى لا يلتقط رقم 1 من 10 أو 12.
   */
  const knownSizes = [18, 13, 12, 10, 5, 4, 3, 2, 1];

  for (const size of knownSizes) {
    const re = new RegExp("(^|\\D)" + size + "(\\D|$)", "i");

    if (re.test(text)) {
      return size;
    }
  }

  return null;
}

function extractAllCapacityLiters(payload) {
  const found = new Set();

  const add = (value) => {
    const number = Number(normalizeArabicDigits(value));
    if (Number.isFinite(number) && number > 0 && number <= 100) {
      found.add(number);
    }
  };

  for (const value of [
    payload.capacity_liters,
    payload.capacity_litre,
    payload.volume_liters,
    payload.volume_litre,
    payload.liters,
    payload.litres,
    payload.size_liters,
    payload.size_litre,
    payload.pack_size_liters,
    payload.pack_size_litre
  ]) {
    if (Array.isArray(value)) {
      for (const item of value) add(item);
    } else {
      add(value);
    }
  }

  const text = normalizeText(getPayloadSearchText(payload));
  const patterns = [
    /(?:^|\D)(\d+(?:\.\d+)?)\s*(?:l|lt|ltr|liter|liters|litre|litres|??????|????????)(?:\D|$)/gi,
    /(?:^|\D)(\d+(?:\.\d+)?)\s*[- ]?\s*(?:l|lt|ltr)(?:\D|$)/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) {
      add(match[1]);
    }
  }

  const knownSizes = [18, 13, 12, 10, 5, 4, 3, 2, 1];
  for (const size of knownSizes) {
    const re = new RegExp("(^|\\D)" + size + "(\\D|$)", "i");
    if (re.test(text)) found.add(size);
  }

  return [...found].sort((a, b) => a - b);
}

function normalizeProductAssetList(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeProductAssetList(item));
  }

  if (value === null || value === undefined) return [];

  return String(value)
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getExplicitProductAssetIds(payload) {
  return [
    ...normalizeProductAssetList(payload.product_asset_ids),
    ...normalizeProductAssetList(payload.product_assets),
    ...normalizeProductAssetList(payload.product_ids),
    ...normalizeProductAssetList(payload.products)
  ];
}

function sortProductIdsByCapacity(productIds) {
  return [...productIds].sort((a, b) => {
    const am = String(a).match(/(\d+(?:\.\d+)?)/);
    const bm = String(b).match(/(\d+(?:\.\d+)?)/);
    const an = am ? Number(am[1]) : Number.MAX_SAFE_INTEGER;
    const bn = bm ? Number(bm[1]) : Number.MAX_SAFE_INTEGER;
    return an - bn || String(a).localeCompare(String(b));
  });
}

function productCandidateText(productId, product) {
  return [
    productId,
    product?.id,
    product?.key,
    product?.sku,
    product?.code,
    product?.name,
    product?.title,
    product?.label,
    product?.description,
    product?.size,
    product?.capacity,
    product?.volume,
    product?.package_size,
    product?.pack_size,
    product?.file
  ]
    .filter((value) => value !== null && value !== undefined && String(value).trim())
    .map(String)
    .join(" ");
}

function productHasCapacity(productId, product, capacityLiters) {
  if (!capacityLiters) return false;

  const numericFields = [
    product?.capacity_liters,
    product?.capacity_litre,
    product?.volume_liters,
    product?.volume_litre,
    product?.liters,
    product?.litres,
    product?.size_liters,
    product?.size_litre,
    product?.pack_size_liters,
    product?.pack_size_litre
  ];

  for (const value of numericFields) {
    const number = Number(normalizeArabicDigits(value));

    if (Number.isFinite(number) && number === capacityLiters) {
      return true;
    }
  }

  const text = normalizeText(productCandidateText(productId, product));
  const compact = compactText(productCandidateText(productId, product));

  const size = String(capacityLiters).replace(/\.0+$/, "");

  const capacityPatterns = [
    new RegExp("(^|\\D)" + size + "\\s*(l|lt|ltr|liter|liters|litre|litres|لتر|ليتر)(\\D|$)", "i"),
    new RegExp("(^|\\D)" + size + "\\s*[- ]?\\s*(l|lt|ltr)(\\D|$)", "i"),
    new RegExp("(^|\\D)" + size + "\\s*لتر(\\D|$)", "i")
  ];

  if (capacityPatterns.some((pattern) => pattern.test(text))) {
    return true;
  }

  const compactPatterns = [
    size + "l",
    size + "lt",
    size + "ltr",
    size + "liter",
    size + "litre",
    size + "liters",
    size + "litres",
    size + "لتر",
    size + "ليتر"
  ];

  if (compactPatterns.some((token) => compact.includes(token))) {
    return true;
  }

  /**
   * Fallback مضبوط:
   * يطابق الرقم كجزء مستقل في product id أو اسم الملف أو الاسم.
   */
  const standaloneNumber = new RegExp("(^|\\D)" + size + "(\\D|$)", "i");

  return standaloneNumber.test(text);
}

function scoreProductMatch(productId, product, payload, capacityLiters) {
  const searchText = normalizeText(getPayloadSearchText(payload));
  const searchCompact = compactText(getPayloadSearchText(payload));

  const candidateText = normalizeText(productCandidateText(productId, product));
  const candidateCompact = compactText(productCandidateText(productId, product));

  let score = 0;
  const reasons = [];

  const explicitKeys = [
    payload.product_asset_id,
    payload.product_key,
    payload.product_code,
    payload.product_id,
    payload.sku,
    payload.product_sku
  ]
    .filter((value) => value !== null && value !== undefined && String(value).trim())
    .map((value) => compactText(value));

  const productIdCompact = compactText(productId);

  for (const key of explicitKeys) {
    if (!key) continue;

    if (productIdCompact === key) {
      score += 1000;
      reasons.push("exact explicit key match");
    } else if (candidateCompact.includes(key) || key.includes(productIdCompact)) {
      score += 600;
      reasons.push("partial explicit key match");
    }
  }

  if (capacityLiters && productHasCapacity(productId, product, capacityLiters)) {
    score += 300;
    reasons.push("capacity match " + capacityLiters + "L");
  }

  /**
   * Product/category hints.
   */
  const categoryWords = [
    "sunflower",
    "refined",
    "oil",
    "زيت",
    "دوار",
    "الشمس"
  ];

  for (const word of categoryWords) {
    if (searchCompact.includes(compactText(word)) && candidateCompact.includes(compactText(word))) {
      score += 20;
      reasons.push("category word match: " + word);
    }
  }

  /**
   * Prefer marketing-approved products.
   */
  if (product?.approved_for_marketing === true) {
    score += 25;
    reasons.push("approved for marketing");
  }

  return {
    productId,
    product,
    score,
    reasons
  };
}

function findProductAssetId(profile, payload) {
  const products = profile.products || {};
  const productIds = Object.keys(products);

  if (!productIds.length) {
    return {
      product_asset_id: null,
      reason: "brand profile has no products",
      capacity_liters: null,
      candidates: []
    };
  }

  /**
   * 1. Exact product_asset_id if provided.
   */
  const explicitProductAssetId = String(payload.product_asset_id || "").trim();

  if (explicitProductAssetId) {
    const normalizedExplicit = compactText(explicitProductAssetId);

    const exactId = productIds.find((id) => compactText(id) === normalizedExplicit);

    if (exactId) {
      return {
        product_asset_id: exactId,
        reason: "matched explicit product_asset_id",
        capacity_liters: extractCapacityLiters(payload),
        candidates: [{ productId: exactId, score: 1000, reasons: ["explicit product_asset_id"] }]
      };
    }
  }

  const capacityLiters = extractCapacityLiters(payload);

  const scored = productIds
    .map((productId) => scoreProductMatch(productId, products[productId], payload, capacityLiters))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return {
      product_asset_id: null,
      reason: "no product matched payload text or capacity",
      capacity_liters: capacityLiters,
      candidates: []
    };
  }

  const best = scored[0];

  return {
    product_asset_id: best.productId,
    reason: "selected highest scoring product match",
    capacity_liters: capacityLiters,
    candidates: scored.slice(0, 5).map((candidate) => ({
      productId: candidate.productId,
      score: candidate.score,
      reasons: candidate.reasons
    }))
  };
}

const logoRelative = profile.logos?.[logoId];

if (!logoRelative) {
  throw new Error("Requested logo asset is unavailable");
}

const templateBackgroundRelative = String(profile.template_background || "logo/background.png");
let templateBackgroundPath;

try {
  templateBackgroundPath = resolveAsset(templateBackgroundRelative);
} catch {
  throw new Error("Fixed template background is unavailable");
}

function findProductAssetIds(profile, payload) {
  const products = profile.products || {};
  const productIds = Object.keys(products);
  const explicitIds = getExplicitProductAssetIds(payload);
  const wantsAll =
    String(payload.layout_mode || "").toLowerCase() === "all" ||
    String(payload.product_selection || "").toLowerCase() === "all" ||
    explicitIds.some((id) => ["all", "all-products", "all_products"].includes(compactText(id)));

  if (wantsAll) {
    const approvedIds = sortProductIdsByCapacity(
      productIds.filter((id) => products[id]?.approved_for_marketing === true)
    );

    return {
      product_asset_ids: approvedIds,
      reason: "selected all approved marketing products",
      capacity_liters: approvedIds.map((id) => {
        const match = String(id).match(/(\d+(?:\.\d+)?)/);
        return match ? Number(match[1]) : null;
      }).filter((value) => value !== null),
      candidates: approvedIds.map((productId) => ({ productId, score: 1000, reasons: ["all approved products"] }))
    };
  }

  const selected = [];
  const candidates = [];

  for (const explicitId of explicitIds) {
    const normalized = compactText(explicitId);
    const exactId = productIds.find((id) => compactText(id) === normalized);

    if (exactId && !selected.includes(exactId)) {
      selected.push(exactId);
      candidates.push({ productId: exactId, score: 1000, reasons: ["explicit product_asset_ids"] });
    }
  }

  const capacities = extractAllCapacityLiters(payload);

  for (const capacityLiters of capacities) {
    const scored = productIds
      .map((productId) => scoreProductMatch(productId, products[productId], payload, capacityLiters))
      .filter((candidate) => candidate.score > 0 && productHasCapacity(candidate.productId, candidate.product, capacityLiters))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (best && !selected.includes(best.productId)) {
      selected.push(best.productId);
      candidates.push({ productId: best.productId, score: best.score, reasons: best.reasons });
    }
  }

  if (selected.length) {
    return {
      product_asset_ids: sortProductIdsByCapacity(selected),
      reason: selected.length > 1 ? "selected multiple product assets" : "selected single product asset",
      capacity_liters: capacities,
      candidates
    };
  }

  const single = findProductAssetId(profile, payload);

  return {
    product_asset_ids: single.product_asset_id ? [single.product_asset_id] : [],
    reason: single.reason,
    capacity_liters: single.capacity_liters ? [single.capacity_liters] : [],
    candidates: single.candidates || []
  };
}

const productResolution = findProductAssetIds(profile, payload);
const productAssetIds = productResolution.product_asset_ids || [];
const productAssets = productAssetIds.map((productAssetId) => {
  const product = profile.products?.[productAssetId];

  if (!product) {
    throw new Error("Requested product asset is unavailable: " + productAssetId);
  }

  if (product.approved_for_marketing !== true) {
    throw new Error(product.restriction || "Requested product asset is not approved for marketing: " + productAssetId);
  }

  return {
    product_asset_id: productAssetId,
    product_path: resolveAsset(product.file),
    file: product.file
  };
});

const primaryProduct = productAssets[0] || null;

return [
  {
    json: {
      cp,
      asset_contract: {
        brand_id: brandId,
        logo_id: logoId,
        product_asset_id: primaryProduct ? primaryProduct.product_asset_id : null,
        product_asset_ids: productAssets.map((product) => product.product_asset_id),
        product_resolution: productResolution,
        ratio,
        profile_version: profile.schema_version,
        brand_theme: profile.brand_theme || {},
        layout_rules: profile.layout_rules || {},
        logo_path: resolveAsset(logoRelative),
        product_path: primaryProduct ? primaryProduct.product_path : null,
        product_paths: productAssets.map((product) => product.product_path),
        products: productAssets,
        template_background_path: templateBackgroundPath
      }
    }
  }
];
