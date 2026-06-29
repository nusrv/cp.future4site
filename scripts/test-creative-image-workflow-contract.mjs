import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

const dir = path.join(process.cwd(), "workflows", "n8n", "generated");
const intake = JSON.parse(fs.readFileSync(path.join(dir, "10-creative-image-generation.json"), "utf8"));
const result = JSON.parse(fs.readFileSync(path.join(dir, "13-creative-image-result-callback.json"), "utf8"));
const code = (workflow, name) => workflow.nodes.find((node) => node.name === name)?.parameters?.jsCode;

function run(jsCode, globals) {
  const names = Object.keys(globals);
  const values = Object.values(globals);
  return Function(...names, jsCode)(...values);
}

const n8nSigningKey = "n8n-test-secret-at-least-32-characters";
const callbackSigningKey = "callback-test-secret-at-least-32-chars";
const magnificSigningKey = "magnific-webhook-test-secret";
const cpBody = {
  job_id: "job_test_123",
  correlation_id: "corr_test_123",
  idempotency_key: "creative:test:123",
  workflow_type: "creative_image_generation",
  workflow_version: "creative-image-v1",
  callback_url: "https://cp.example.test/api/automation/callback",
  payload: {
    brand: "Future Oils",
    product: "Refined Sunflower Oil",
    market: "Gulf/MENA",
    headline: "Reliable supply for professional buyers",
    caption: "Approved B2B copy for importers and distributors."
  }
};
const cpTimestamp = new Date().toISOString();
const cpNonce = "cp_nonce_test";
const cpRaw = JSON.stringify(cpBody);
const cpSignature = crypto.createHmac("sha256", n8nSigningKey).update(`${cpTimestamp}.${cpNonce}.${cpRaw}`).digest("hex");
const validated = run(code(intake, "Validate Signed CP Request"), {
  $json: { body: cpBody, headers: { "x-ff-signature": cpSignature, "x-ff-timestamp": cpTimestamp, "x-ff-nonce": cpNonce } },
  $env: { N8N_WEBHOOK_SECRET: n8nSigningKey }, require, Buffer
})[0].json;
if (!validated.accepted || validated.cp.job_id !== cpBody.job_id) throw new Error("Signed CP request validation failed");

const built = run(code(intake, "Build Magnific Request"), { $json: validated, URLSearchParams })[0].json;
if (!built.magnific_request.prompt.includes("Future Oils") || built.magnific_request.structure_reference.length < 40000) throw new Error("Magnific request did not include brand prompt/reference");
const resultUrl = new URL(built.magnific_request.webhook_url);
if (resultUrl.searchParams.get("job_id") !== cpBody.job_id || resultUrl.searchParams.get("callback_url") !== cpBody.callback_url) throw new Error("Magnific result callback context is incomplete");

const submitted = run(code(intake, "Prepare Submission Status Callback"), {
  $json: { data: { task_id: "magnific_task_123", status: "IN_PROGRESS" } },
  $env: { PLATFORM_CALLBACK_SECRET: callbackSigningKey }, require,
  $: () => ({ item: { json: built } })
})[0].json;
const submittedRaw = JSON.stringify(submitted.callback_body);
const submittedExpected = crypto.createHmac("sha256", callbackSigningKey).update(`${submitted.callback_headers.timestamp}.${submitted.callback_headers.nonce}.${submittedRaw}`).digest("hex");
if (submitted.callback_headers.signature !== submittedExpected || submitted.callback_body.status !== "waiting_for_external_service") throw new Error("Submission callback signature/status failed");

const magnificBody = { task_id: "magnific_task_123", status: "COMPLETED", generated: ["https://ai-statics.freepik.com/test-image.jpg"], has_nsfw: [false] };
const magnificId = "webhook_test_123";
const magnificTimestamp = String(Math.floor(Date.now() / 1000));
const magnificRaw = JSON.stringify(magnificBody);
const magnificSignature = crypto.createHmac("sha256", magnificSigningKey).update(`${magnificId}.${magnificTimestamp}.${magnificRaw}`).digest("base64");
const mapped = run(code(result, "Verify Magnific And Prepare CP Callback"), {
  $json: {
    body: magnificBody,
    headers: { "webhook-id": magnificId, "webhook-timestamp": magnificTimestamp, "webhook-signature": `v1,${magnificSignature}` },
    query: Object.fromEntries(resultUrl.searchParams.entries())
  },
  $env: { MAGNIFIC_WEBHOOK_SECRET: magnificSigningKey, PLATFORM_CALLBACK_SECRET: callbackSigningKey }, require, Buffer
})[0].json;
const mappedRaw = JSON.stringify(mapped.callback_body);
const mappedExpected = crypto.createHmac("sha256", callbackSigningKey).update(`${mapped.callback_headers.timestamp}.${mapped.callback_headers.nonce}.${mappedRaw}`).digest("hex");
if (mapped.callback_headers.signature !== mappedExpected) throw new Error("Completed callback signature failed");
if (mapped.callback_body.status !== "completed" || mapped.callback_body.files.length !== 1 || mapped.callback_body.files[0].url !== magnificBody.generated[0]) throw new Error("Completed image result mapping failed");

let rejected = false;
try {
  run(code(intake, "Validate Signed CP Request"), {
    $json: { body: cpBody, headers: { "x-ff-signature": "00", "x-ff-timestamp": cpTimestamp, "x-ff-nonce": cpNonce } },
    $env: { N8N_WEBHOOK_SECRET: n8nSigningKey }, require, Buffer
  });
} catch { rejected = true; }
if (!rejected) throw new Error("Invalid CP request signature was accepted");

console.log("Creative image cryptographic contract test passed.");
console.log("validated: CP request HMAC, Magnific result HMAC, CP callback HMAC, image mapping, invalid-signature rejection");