const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

function clampNumber(value, fallback, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return Math.min(max, Math.max(min, number));
}

const resolved = $("Resolve Brand Assets").item.json;
const payload = resolved.cp?.payload ?? {};
const contract = resolved.asset_contract;

if (!contract) {
  throw new Error("Missing asset_contract from Resolve Brand Assets");
}

if (!contract.template_background_path || !fs.existsSync(contract.template_background_path)) {
  throw new Error("Fixed template background is unavailable");
}

const productPaths = Array.isArray(contract.product_paths) && contract.product_paths.length
  ? contract.product_paths
  : contract.product_path
    ? [contract.product_path]
    : [];

if (!productPaths.length) {
  throw new Error(contract.product_resolution?.reason || "Product image is required for fixed template composition");
}

for (const productPath of productPaths) {
  if (!fs.existsSync(productPath)) {
    throw new Error("Product file does not exist: " + productPath);
  }
}

const dimensions = {
  "4:5": [1080, 1350],
  "1:1": [1080, 1080],
  "9:16": [1080, 1920]
}[contract.ratio];

if (!dimensions) {
  throw new Error("Unsupported ratio: " + contract.ratio);
}

const [width, height] = dimensions;
const backgroundBuffer = fs.readFileSync(contract.template_background_path);

try {
  await sharp(backgroundBuffer).metadata();
} catch (error) {
  throw new Error("Sharp could not read fixed template background: " + error.message);
}

async function trimProductBuffer(productPath) {
  const sourceBuffer = fs.readFileSync(productPath);

  try {
    await sharp(sourceBuffer).metadata();
  } catch (error) {
    throw new Error("Sharp could not read product image: " + error.message);
  }

  return sharp(sourceBuffer)
    .trim({
      threshold: 10,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
}

function getProductFrame(targetWidth, targetHeight) {
  return {
    x: Math.round(targetWidth * 0.2086),
    y: Math.round(targetHeight * 0.2290),
    w: Math.round(targetWidth * 0.6105),
    h: Math.round(targetHeight * 0.6469)
  };
}

async function buildProductComposite(targetWidth, targetHeight, productPath) {
  const frame = getProductFrame(targetWidth, targetHeight);
  const baseline = frame.y + frame.h;
  const trimmedBuffer = await trimProductBuffer(productPath);
  const productBuffer = await sharp(trimmedBuffer)
    .resize({
      width: frame.w,
      height: frame.h,
      fit: "inside",
      withoutEnlargement: false
    })
    .png()
    .toBuffer();
  const productMeta = await sharp(productBuffer).metadata();
  const productWidth = productMeta.width || 0;
  const productHeight = productMeta.height || 0;

  return {
    input: productBuffer,
    left: Math.round(frame.x + (frame.w - productWidth) / 2),
    top: Math.round(baseline - productHeight)
  };
}

async function renderJpeg(productPath, targetWidth, targetHeight, quality) {
  const productComposite = await buildProductComposite(targetWidth, targetHeight, productPath);

  return sharp(backgroundBuffer)
    .resize(targetWidth, targetHeight, {
      fit: "cover",
      position: "center"
    })
    .composite([productComposite])
    .flatten({
      background: "#ffffff"
    })
    .jpeg({
      quality,
      mozjpeg: true
    })
    .toBuffer();
}
const maxCallbackImageBytes = clampNumber(
  payload.max_callback_image_bytes,
  650 * 1024,
  180 * 1024,
  2 * 1024 * 1024
);
const maxCallbackTotalImageBytes = clampNumber(
  payload.max_callback_total_image_bytes,
  5 * 1024 * 1024,
  1 * 1024 * 1024,
  8 * 1024 * 1024
);
const perImageLimit = Math.max(
  180 * 1024,
  Math.min(maxCallbackImageBytes, Math.floor(maxCallbackTotalImageBytes / productPaths.length))
);

async function renderProductFile(productPath, index) {
  let outputWidth = width;
  let outputHeight = height;
  let finalBuffer = null;
  let finalQuality = null;

  for (const quality of [82, 78, 74, 70, 66, 62, 58, 54, 50, 46, 42]) {
    const candidate = await renderJpeg(productPath, width, height, quality);
    finalBuffer = candidate;
    finalQuality = quality;
    if (candidate.length <= perImageLimit) break;
  }

  if (finalBuffer.length > perImageLimit) {
    outputWidth = Math.round(width * 0.85);
    outputHeight = Math.round(height * 0.85);

    for (const quality of [78, 74, 70, 66, 62, 58, 54, 50, 46, 42]) {
      const candidate = await renderJpeg(productPath, outputWidth, outputHeight, quality);
      finalBuffer = candidate;
      finalQuality = quality;
      if (candidate.length <= perImageLimit) break;
    }
  }

  const productAssetId = contract.product_asset_ids?.[index] || `product-${index + 1}`;
  return {
    name: `creative-${resolved.cp.job_id}-${productAssetId}.jpg`,
    mime_type: "image/jpeg",
    data_base64: finalBuffer.toString("base64"),
    size_bytes: finalBuffer.length,
    width: outputWidth,
    height: outputHeight,
    quality: finalQuality,
    product_asset_id: productAssetId,
    position: index + 1
  };
}

const composedFiles = [];
for (let index = 0; index < productPaths.length; index++) {
  composedFiles.push(await renderProductFile(productPaths[index], index));
}

return [
  {
    json: {
      cp: resolved.cp,
      asset_contract: contract,
      provider_creation_id: String(resolved.cp.job_id) + "_fixed_template",
      composed_file: composedFiles[0],
      composed_files: composedFiles,
      product_layout: {
        mode: "separate-images",
        product_count: productPaths.length,
        product_asset_ids: contract.product_asset_ids || []
      },
      template_background_source: path.basename(contract.template_background_path)
    }
  }
];