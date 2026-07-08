const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

function clampNumber(value, fallback, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return Math.min(max, Math.max(min, number));
}

/**
 * Read data from previous node.
 */
const resolved = $("Resolve Brand Assets").item.json;
const payload = resolved.cp?.payload ?? {};
const contract = resolved.asset_contract;

if (!contract) {
  throw new Error("Missing asset_contract from Resolve Brand Assets");
}

if (!contract.template_background_path) {
  throw new Error("Fixed template background is unavailable");
}

if (!fs.existsSync(contract.template_background_path)) {
  throw new Error("Fixed template background is unavailable");
}

if (!contract.product_path) {
  throw new Error("Product image is required for fixed template composition");
}

if (!fs.existsSync(contract.product_path)) {
  throw new Error("Product file does not exist: " + contract.product_path);
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
const productSourceBuffer = fs.readFileSync(contract.product_path);

try {
  await sharp(backgroundBuffer).metadata();
} catch (error) {
  throw new Error("Sharp could not read fixed template background: " + error.message);
}

try {
  await sharp(productSourceBuffer).metadata();
} catch (error) {
  throw new Error("Sharp could not read product image: " + error.message);
}

async function buildProductComposite(targetWidth, targetHeight) {
  const productFrame = {
    x: Math.round(targetWidth * 0.2086),
    y: Math.round(targetHeight * 0.2247),
    w: Math.round(targetWidth * 0.5294),
    h: Math.round(targetHeight * 0.6355)
  };

  const productBuffer = await sharp(productSourceBuffer)
    .resize({
      width: productFrame.w,
      height: productFrame.h,
      fit: "inside",
      withoutEnlargement: false
    })
    .png()
    .toBuffer();

  const productMeta = await sharp(productBuffer).metadata();
  const productWidth = productMeta.width || 0;
  const productHeight = productMeta.height || 0;

  const productLeft = Math.round(
    productFrame.x + (productFrame.w - productWidth) / 2
  );

  const productTop = Math.round(
    productFrame.y + productFrame.h - productHeight
  );

  return {
    input: productBuffer,
    left: productLeft,
    top: productTop
  };
}

async function renderJpeg(targetWidth, targetHeight, quality) {
  const productComposite = await buildProductComposite(targetWidth, targetHeight);

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
      template_background_source: path.basename(contract.template_background_path)
    }
  }
];

