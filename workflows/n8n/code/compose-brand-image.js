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
  throw new Error("Product image is required for fixed template composition");
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

function getLayoutSlots(frame, count) {
  if (count <= 1) {
    return [{ x: frame.x, y: frame.y, w: frame.w, h: frame.h, maxHeightRatio: 1 }];
  }

  if (count === 2) {
    return [
      { x: frame.x, y: frame.y, w: Math.round(frame.w * 0.56), h: frame.h, maxHeightRatio: 0.98 },
      { x: frame.x + Math.round(frame.w * 0.44), y: frame.y, w: Math.round(frame.w * 0.56), h: frame.h, maxHeightRatio: 0.98 }
    ];
  }

  if (count === 3) {
    return [
      { x: frame.x, y: frame.y, w: Math.round(frame.w * 0.36), h: frame.h, maxHeightRatio: 0.84 },
      { x: frame.x + Math.round(frame.w * 0.25), y: frame.y, w: Math.round(frame.w * 0.50), h: frame.h, maxHeightRatio: 1.00 },
      { x: frame.x + Math.round(frame.w * 0.64), y: frame.y, w: Math.round(frame.w * 0.36), h: frame.h, maxHeightRatio: 0.84 }
    ];
  }

  const gap = Math.round(frame.w * 0.015);
  const slotWidth = Math.max(1, Math.floor((frame.w + gap) / count));

  return Array.from({ length: count }, (_, index) => ({
    x: frame.x + index * (slotWidth - gap),
    y: frame.y,
    w: slotWidth,
    h: frame.h,
    maxHeightRatio: count > 5 ? 0.76 : 0.82
  }));
}

async function buildProductComposites(targetWidth, targetHeight) {
  const frame = getProductFrame(targetWidth, targetHeight);
  const slots = getLayoutSlots(frame, productPaths.length);
  const baseline = frame.y + frame.h;
  const composites = [];

  for (let index = 0; index < productPaths.length; index++) {
    const slot = slots[index];
    const trimmedBuffer = await trimProductBuffer(productPaths[index]);
    const slotHeight = Math.max(1, Math.round(slot.h * (slot.maxHeightRatio || 1)));

    const productBuffer = await sharp(trimmedBuffer)
      .resize({
        width: slot.w,
        height: slotHeight,
        fit: "inside",
        withoutEnlargement: false
      })
      .png()
      .toBuffer();

    const productMeta = await sharp(productBuffer).metadata();
    const productWidth = productMeta.width || 0;
    const productHeight = productMeta.height || 0;

    composites.push({
      input: productBuffer,
      left: Math.round(slot.x + (slot.w - productWidth) / 2),
      top: Math.round(baseline - productHeight)
    });
  }

  return composites;
}

async function renderJpeg(targetWidth, targetHeight, quality) {
  const productComposites = await buildProductComposites(targetWidth, targetHeight);

  return sharp(backgroundBuffer)
    .resize(targetWidth, targetHeight, {
      fit: "cover",
      position: "center"
    })
    .composite(productComposites)
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
  220 * 1024,
  2 * 1024 * 1024
);

let outputWidth = width;
let outputHeight = height;
let finalBuffer = null;
let finalQuality = null;

for (const quality of [82, 78, 74, 70, 66, 62, 58, 54, 50, 46, 42]) {
  const candidate = await renderJpeg(width, height, quality);

  finalBuffer = candidate;
  finalQuality = quality;

  if (candidate.length <= maxCallbackImageBytes) {
    break;
  }
}

if (finalBuffer.length > maxCallbackImageBytes) {
  outputWidth = Math.round(width * 0.85);
  outputHeight = Math.round(height * 0.85);

  for (const quality of [78, 74, 70, 66, 62, 58, 54, 50, 46, 42]) {
    const candidate = await renderJpeg(outputWidth, outputHeight, quality);

    finalBuffer = candidate;
    finalQuality = quality;

    if (candidate.length <= maxCallbackImageBytes) {
      break;
    }
  }
}

return [
  {
    json: {
      cp: resolved.cp,
      asset_contract: contract,
      provider_creation_id: String(resolved.cp.job_id) + "_fixed_template",
      composed_file: {
        name: "creative-" + resolved.cp.job_id + ".jpg",
        mime_type: "image/jpeg",
        data_base64: finalBuffer.toString("base64"),
        size_bytes: finalBuffer.length,
        width: outputWidth,
        height: outputHeight,
        quality: finalQuality
      },
      product_layout: {
        mode: productPaths.length === 1 ? "single" : productPaths.length <= 3 ? "group" : "lineup",
        product_count: productPaths.length,
        product_asset_ids: contract.product_asset_ids || []
      },
      template_background_source: path.basename(contract.template_background_path)
    }
  }
];

