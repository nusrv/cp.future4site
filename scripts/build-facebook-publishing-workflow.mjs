import fs from "node:fs";
import path from "node:path";

const generatedDir = path.join(process.cwd(), "workflows", "n8n", "generated");
fs.mkdirSync(generatedDir, { recursive: true });

function codeNode(id, name, jsCode, position) {
  return { id, name, type: "n8n-nodes-base.code", typeVersion: 2, position, parameters: { jsCode } };
}

function webhookNode(id, name, webhookPath, position) {
  return {
    id,
    name,
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position,
    parameters: {
      path: webhookPath,
      httpMethod: "POST",
      responseMode: "responseNode",
      options: {}
    }
  };
}

function respondNode(id, name, position, responseBody) {
  return {
    id,
    name,
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1,
    position,
    parameters: { respondWith: "json", responseBody, options: {} }
  };
}

function ifNode(id, name, position, leftValue, rightValue = true) {
  return {
    id,
    name,
    type: "n8n-nodes-base.if",
    typeVersion: 2,
    position,
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
        conditions: [
          { leftValue, rightValue, operator: { type: "boolean", operation: "equals" } }
        ],
        combinator: "and"
      },
      options: {}
    }
  };
}

function callbackNode(id, position) {
  return {
    id,
    name: "Send Signed Callback To CP",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4,
    position,
    parameters: {
      method: "POST",
      url: "={{ $json.callback_url }}",
      sendHeaders: true,
      headerParameters: { parameters: [
        { name: "content-type", value: "application/json" },
        { name: "x-ff-signature", value: "={{ $json.callback_headers.signature }}" },
        { name: "x-ff-timestamp", value: "={{ $json.callback_headers.timestamp }}" },
        { name: "x-ff-nonce", value: "={{ $json.callback_headers.nonce }}" }
      ] },
      sendBody: true,
      specifyBody: "json",
      jsonBody: "={{ $json.callback_body }}",
      options: {}
    }
  };
}

const validateCpRequest = `const crypto = require("crypto");
const envelope = $json;
const body = envelope.body ?? envelope;
const headers = envelope.headers ?? {};
const signature = String(headers["x-ff-signature"] ?? "");
const timestamp = String(headers["x-ff-timestamp"] ?? "");
const nonce = String(headers["x-ff-nonce"] ?? "");
const secret = $env.N8N_WEBHOOK_SECRET;
if (!secret) throw new Error("Missing N8N_WEBHOOK_SECRET in n8n environment");
if (!signature || !timestamp || !nonce) throw new Error("Missing CP request signature headers");
if (!body.job_id || !body.correlation_id || !body.callback_url) throw new Error("Missing job_id, correlation_id, or callback_url");
if (body.workflow_type !== "publish_facebook") throw new Error("Unexpected workflow_type");
const drift = Math.abs(Date.now() - Date.parse(timestamp));
if (!Number.isFinite(drift) || drift > 5 * 60 * 1000) throw new Error("CP request timestamp rejected");
const raw = JSON.stringify(body);
const expected = crypto.createHmac("sha256", secret).update(timestamp + "." + nonce + "." + raw).digest("hex");
const supplied = Buffer.from(signature, "hex");
const calculated = Buffer.from(expected, "hex");
if (supplied.length !== calculated.length || !crypto.timingSafeEqual(supplied, calculated)) throw new Error("Invalid CP request signature");
return [{ json: { cp: body, accepted: true, received_at: new Date().toISOString() } }];`;

const prepareFacebookMedia = `const cp = $json.cp;
const payload = cp.payload ?? {};
if (payload.platform !== "facebook") throw new Error("Facebook publishing workflow received non-facebook payload");
const dryRun = payload.dryRun === true;
const graphVersion = String($env.META_GRAPH_API_VERSION || "v23.0");
const pageId = String($env.FUTURE_OILS_FACEBOOK_PAGE_ID || "").trim();
const accessToken = String($env.FUTURE_OILS_FACEBOOK_ACCESS_TOKEN || "").trim();
if (!pageId) throw new Error("Missing FUTURE_OILS_FACEBOOK_PAGE_ID in n8n environment");
if (!accessToken) throw new Error("Missing FUTURE_OILS_FACEBOOK_ACCESS_TOKEN in n8n environment");
const caption = [payload.caption, payload.cta].filter((value) => typeof value === "string" && value.trim()).join("\\n\\n");
const mediaFiles = Array.isArray(payload.media_files) ? payload.media_files : [];
if (!dryRun && !mediaFiles.length) throw new Error("Facebook publishing requires at least one approved media file");
if (dryRun) {
  return [{ json: { cp, dry_run: true, graph_version: graphVersion, page_id: pageId, caption, media_count: mediaFiles.length } }];
}
return mediaFiles
  .sort((a, b) => Number(a.position || 1) - Number(b.position || 1))
  .map((file, index) => {
    if (!file.download_url) throw new Error("Approved media file is missing download_url");
    return {
      json: {
        cp,
        dry_run: false,
        graph_version: graphVersion,
        page_id: pageId,
        access_token: accessToken,
        caption,
        media_count: mediaFiles.length,
        media_index: index + 1,
        media_download_url: String(file.download_url),
        publish_immediately: mediaFiles.length === 1,
        facebook_upload_url: "https://graph.facebook.com/" + graphVersion + "/" + pageId + "/photos"
      }
    };
  });`;

const prepareDryRunCallback = `const crypto = require("crypto");
const item = $json;
const cp = item.cp;
const secret = $env.PLATFORM_CALLBACK_SECRET;
if (!secret) throw new Error("Missing PLATFORM_CALLBACK_SECRET in n8n environment");
const timestamp = new Date().toISOString();
const nonce = "n8n_facebook_publish_dry_" + Date.now() + "_" + Math.random().toString(36).slice(2);
const callbackBody = {
  job_id: cp.job_id,
  correlation_id: cp.correlation_id,
  idempotency_key: cp.idempotency_key,
  workflow_type: "publish_facebook",
  workflow_version: "facebook-publishing-v1",
  status: "completed",
  current_step: "Facebook publishing dry-run passed",
  nonce,
  signature_timestamp: timestamp,
  signature: "",
  outputs: {
    provider: "facebook-graph-api",
    dry_run: true,
    platform: "facebook",
    page_id: item.page_id,
    media_count: item.media_count,
    meta_called: false
  },
  warnings: []
};
const raw = JSON.stringify(callbackBody);
const signature = crypto.createHmac("sha256", secret).update(timestamp + "." + nonce + "." + raw).digest("hex");
return [{ json: { callback_url: cp.callback_url, callback_headers: { signature, timestamp, nonce }, callback_body: callbackBody } }];`;

const aggregateFacebookUploads = `const prepared = $("Prepare Facebook Photo Uploads").all().filter((item) => item.json?.dry_run === false);
const uploads = $input.all();
if (!uploads.length) throw new Error("No Facebook upload response received");
const first = prepared[0]?.json;
if (!first?.cp) throw new Error("Missing prepared Facebook publish context");
const uploadedMedia = uploads.map((item, index) => {
  const response = item.json || {};
  const mediaFbid = response.id || response.post_id;
  if (!mediaFbid) throw new Error("Facebook photo upload response did not include an id");
  return { media_fbid: String(mediaFbid), raw: response, position: index + 1 };
});
const single = uploadedMedia.length === 1 && first.publish_immediately === true;
return [{ json: {
  cp: first.cp,
  page_id: first.page_id,
  access_token: first.access_token,
  graph_version: first.graph_version,
  caption: first.caption,
  media_count: uploadedMedia.length,
  uploaded_media: uploadedMedia,
  needs_feed_post: !single,
  facebook_feed_url: "https://graph.facebook.com/" + first.graph_version + "/" + first.page_id + "/feed",
  single_post_id: single ? (uploadedMedia[0].raw.post_id || uploadedMedia[0].raw.id) : null
} }];`;

const prepareCompletedCallback = `const crypto = require("crypto");
const aggregate = $("Aggregate Facebook Uploads").first().json;
const feedResponse = $input.first()?.json || {};
const secret = $env.PLATFORM_CALLBACK_SECRET;
if (!secret) throw new Error("Missing PLATFORM_CALLBACK_SECRET in n8n environment");
const cp = aggregate.cp;
const isMulti = aggregate.needs_feed_post === true;
const platformPostId = String(isMulti ? (feedResponse.id || "") : (aggregate.single_post_id || ""));
if (!platformPostId) throw new Error("Facebook publish response did not include a post id");
const timestamp = new Date().toISOString();
const nonce = "n8n_facebook_publish_" + Date.now() + "_" + Math.random().toString(36).slice(2);
const callbackBody = {
  job_id: cp.job_id,
  correlation_id: cp.correlation_id,
  idempotency_key: cp.idempotency_key,
  workflow_type: "publish_facebook",
  workflow_version: "facebook-publishing-v1",
  status: "completed",
  current_step: isMulti ? "Facebook multi-photo post published" : "Facebook photo post published",
  nonce,
  signature_timestamp: timestamp,
  signature: "",
  outputs: {
    provider: "facebook-graph-api",
    dry_run: false,
    platform: "facebook",
    page_id: aggregate.page_id,
    platform_post_id: platformPostId,
    platform_url: "https://www.facebook.com/" + platformPostId,
    media_count: aggregate.media_count,
    uploaded_media: aggregate.uploaded_media.map((item) => ({ media_fbid: item.media_fbid, position: item.position }))
  },
  warnings: []
};
const raw = JSON.stringify(callbackBody);
const signature = crypto.createHmac("sha256", secret).update(timestamp + "." + nonce + "." + raw).digest("hex");
return [{ json: { callback_url: cp.callback_url, callback_headers: { signature, timestamp, nonce }, callback_body: callbackBody } }];`;

const workflow = {
  name: "FF Admin - Facebook Publishing",
  active: false,
  nodes: [
    webhookNode("facebook-publish-webhook", "CP Facebook Publish Request Webhook", "future-foresight/facebook-publishing", [0, 0]),
    codeNode("validate-cp-request", "Validate Signed CP Request", validateCpRequest, [250, 0]),
    respondNode("respond-cp", "Acknowledge CP Request", [500, 0], '={{ { accepted: true, job_id: $json.cp.job_id, workflow_type: "publish_facebook" } }}'),
    codeNode("prepare-facebook-media", "Prepare Facebook Photo Uploads", prepareFacebookMedia, [750, 0]),
    ifNode("dry-run-check", "Is Dry Run", [1000, 0], "={{ $json.dry_run }}"),
    codeNode("prepare-dry-run-callback", "Prepare Dry Run CP Callback", prepareDryRunCallback, [1250, -180]),
    {
      id: "upload-facebook-photo",
      name: "Upload Facebook Photo",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1250, 140],
      parameters: {
        method: "POST",
        url: "={{ $json.facebook_upload_url }}",
        sendQuery: true,
        queryParameters: { parameters: [{ name: "access_token", value: "={{ $json.access_token }}" }] },
        sendBody: true,
        contentType: "multipart-form-data",
        bodyParameters: { parameters: [
          { name: "url", value: "={{ $json.media_download_url }}" },
          { name: "published", value: "={{ $json.publish_immediately ? 'true' : 'false' }}" },
          { name: "caption", value: "={{ $json.publish_immediately ? $json.caption : '' }}" }
        ] },
        options: {}
      }
    },
    codeNode("aggregate-facebook-uploads", "Aggregate Facebook Uploads", aggregateFacebookUploads, [1500, 140]),
    ifNode("needs-feed-post", "Needs Multi Photo Feed Post", [1750, 140], "={{ $json.needs_feed_post }}"),
    {
      id: "create-multi-photo-feed-post",
      name: "Create Multi Photo Feed Post",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [2000, 60],
      parameters: {
        method: "POST",
        url: "={{ $json.facebook_feed_url }}",
        sendQuery: true,
        queryParameters: { parameters: [{ name: "access_token", value: "={{ $json.access_token }}" }] },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ { message: $json.caption, attached_media: $json.uploaded_media.map((item) => ({ media_fbid: item.media_fbid })) } }}",
        options: {}
      }
    },
    codeNode("prepare-completed-callback", "Prepare Completed CP Callback", prepareCompletedCallback, [2250, 140]),
    callbackNode("send-completed-callback", [2500, 140])
  ],
  connections: {
    "CP Facebook Publish Request Webhook": { main: [[{ node: "Validate Signed CP Request", type: "main", index: 0 }]] },
    "Validate Signed CP Request": { main: [[{ node: "Acknowledge CP Request", type: "main", index: 0 }]] },
    "Acknowledge CP Request": { main: [[{ node: "Prepare Facebook Photo Uploads", type: "main", index: 0 }]] },
    "Prepare Facebook Photo Uploads": { main: [[{ node: "Is Dry Run", type: "main", index: 0 }]] },
    "Is Dry Run": { main: [
      [{ node: "Prepare Dry Run CP Callback", type: "main", index: 0 }],
      [{ node: "Upload Facebook Photo", type: "main", index: 0 }]
    ] },
    "Prepare Dry Run CP Callback": { main: [[{ node: "Send Signed Callback To CP", type: "main", index: 0 }]] },
    "Upload Facebook Photo": { main: [[{ node: "Aggregate Facebook Uploads", type: "main", index: 0 }]] },
    "Aggregate Facebook Uploads": { main: [[{ node: "Needs Multi Photo Feed Post", type: "main", index: 0 }]] },
    "Needs Multi Photo Feed Post": { main: [
      [{ node: "Create Multi Photo Feed Post", type: "main", index: 0 }],
      [{ node: "Prepare Completed CP Callback", type: "main", index: 0 }]
    ] },
    "Create Multi Photo Feed Post": { main: [[{ node: "Prepare Completed CP Callback", type: "main", index: 0 }]] },
    "Prepare Completed CP Callback": { main: [[{ node: "Send Signed Callback To CP", type: "main", index: 0 }]] }
  },
  settings: {
    executionOrder: "v1",
    saveManualExecutions: true,
    saveDataErrorExecution: "all",
    saveDataSuccessExecution: "all"
  },
  tags: ["future-foresight", "publishing", "facebook", "meta"]
};

fs.writeFileSync(path.join(generatedDir, "13-facebook-publishing.json"), JSON.stringify(workflow, null, 2) + "\n");
console.log("Built Facebook publishing workflow.");