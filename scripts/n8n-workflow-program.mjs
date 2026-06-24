import fs from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "workflows", "n8n", "generated");
fs.mkdirSync(outDir, { recursive: true });

function webhookNode(id, name, pathValue, position = [0, 0]) {
  return {
    id,
    name,
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position,
    parameters: {
      path: pathValue,
      httpMethod: "POST",
      responseMode: "responseNode",
      options: {}
    },
    notes: "Webhook is intentionally draft/inactive. Protect with signature validation before activation."
  };
}

function codeNode(id, name, jsCode, position = [260, 0], notes = "Draft code placeholder. No credentials or external calls.") {
  return {
    id,
    name,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position,
    parameters: { jsCode },
    notes
  };
}

function respondNode(id = "respond", position = [520, 0]) {
  return {
    id,
    name: "Respond To Platform",
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1,
    position,
    parameters: {
      respondWith: "json",
      responseBody: "={{ $json }}"
    },
    notes: "Returns a safe acknowledgement or dry-run result."
  };
}

function callbackHttpNode(id = "callback", position = [780, 0]) {
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
      headerParameters: {
        parameters: [
          { name: "content-type", value: "application/json" },
          { name: "x-ff-signature", value: "={{ $json.callback_headers.signature }}" },
          { name: "x-ff-timestamp", value: "={{ $json.callback_headers.timestamp }}" },
          { name: "x-ff-nonce", value: "={{ $json.callback_headers.nonce }}" }
        ]
      },
      sendBody: true,
      contentType: "json",
      jsonBody: "={{ JSON.stringify($json.callback_body) }}",
      options: {}
    },
    notes: "Sends mock completion back to the CP callback endpoint. Requires PLATFORM_CALLBACK_SECRET to be available to n8n as an environment variable."
  };
}

function httpPlaceholder(id, name, position, notes) {
  return {
    id,
    name,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4,
    position,
    disabled: true,
    parameters: {
      method: "POST",
      url: "PLACEHOLDER_DO_NOT_ACTIVATE",
      sendBody: true,
      contentType: "json",
      jsonBody: "{}",
      options: {}
    },
    notes
  };
}

function workflow(file, name, nodes, connections = {}, tags = []) {
  const data = {
    name,
    active: false,
    nodes,
    connections,
    settings: {
      executionOrder: "v1",
      saveManualExecutions: true,
      saveDataErrorExecution: "all",
      saveDataSuccessExecution: "all"
    },
    tags: ["future-foresight", "draft", ...tags]
  };
  fs.writeFileSync(path.join(outDir, file), `${JSON.stringify(data, null, 2)}\n`);
}

const ack = (workflowType) => `
const body = $json.body ?? $json;
return [{
  json: {
    accepted: true,
    workflow_type: "${workflowType}",
    active: false,
    draft: true,
    external_calls_made: false,
    next_setup: "Add credentials, signature validation, real processing nodes, and signed platform callback before activation.",
    received_job_id: body.job_id ?? null,
    received_correlation_id: body.correlation_id ?? null
  }
}];
`.trim();

workflow(
  "01-content-request-intake-draft.json",
  "FF Admin - Content Request Intake - Draft",
  [
    webhookNode("content-webhook", "Platform Content Request Webhook", "future-foresight/content-generation"),
    codeNode("validate", "Validate Draft Request", ack("content_generation")),
    respondNode(),
    codeNode("prepare-callback", "Prepare Signed Mock Callback", `
const crypto = require("crypto");
const body = $json.body ?? $json;
const secret = $env.PLATFORM_CALLBACK_SECRET;

if (!secret) {
  throw new Error("Missing PLATFORM_CALLBACK_SECRET in n8n environment");
}
if (!body.job_id || !body.correlation_id || !body.callback_url) {
  throw new Error("Missing job_id, correlation_id, or callback_url from CP request");
}

const timestamp = new Date().toISOString();
const nonce = "n8n_" + Date.now() + "_" + Math.random().toString(36).slice(2);
const callbackBody = {
  job_id: body.job_id,
  correlation_id: body.correlation_id,
  idempotency_key: body.idempotency_key,
  workflow_type: body.workflow_type ?? "content_generation",
  workflow_version: body.workflow_version ?? "mock-v1",
  status: "completed",
  current_step: "Mock n8n callback completed",
  nonce,
  signature_timestamp: timestamp,
  signature: "",
  outputs: {
    headline: "Mock Content Test",
    caption: "This is a CP to n8n to CP callback connection test only.",
    cta: "Request a Quote",
    hashtags: ["#FutureOils", "#ConnectionTest"],
    warnings: ["No AI, Magnific, Meta, email, or publishing service was called."]
  },
  files: [],
  warnings: ["Connection test only."]
};
const raw = JSON.stringify(callbackBody);
const signature = crypto.createHmac("sha256", secret).update(timestamp + "." + nonce + "." + raw).digest("hex");

return [{
  json: {
    callback_url: body.callback_url,
    callback_headers: { signature, timestamp, nonce },
    callback_body: callbackBody
  }
}];
`.trim(), [780, 0], "Builds a signed mock completion callback after the webhook response is sent to CP."),
    callbackHttpNode("send-callback", [1040, 0])
  ],
  {
    "Platform Content Request Webhook": { main: [[{ node: "Validate Draft Request", type: "main", index: 0 }]] },
    "Validate Draft Request": { main: [[{ node: "Respond To Platform", type: "main", index: 0 }]] },
    "Respond To Platform": { main: [[{ node: "Prepare Signed Mock Callback", type: "main", index: 0 }]] },
    "Prepare Signed Mock Callback": { main: [[{ node: "Send Signed Callback To CP", type: "main", index: 0 }]] }
  },
  ["marketing", "webhook"]
);

workflow(
  "02-publication-dry-run-draft.json",
  "FF Admin - Publication Dry Run - Draft",
  [
    webhookNode("publish-webhook", "Platform Publish Dry Run Webhook", "future-foresight/publish-dry-run"),
    codeNode("summary", "Dry Run Summary Only", `
const body = $json.body ?? $json;
return [{
  json: {
    dry_run: true,
    meta_called: false,
    duplicate_check_required: true,
    platforms_requested: body.platforms ?? [],
    content_item_id: body.content_item_id ?? null,
    status: "validated_dry_run"
  }
}];
`.trim(), [260, 0], "Safe dry-run path. It must not call Meta endpoints."),
    respondNode()
  ],
  {
    "Platform Publish Dry Run Webhook": { main: [[{ node: "Dry Run Summary Only", type: "main", index: 0 }]] },
    "Dry Run Summary Only": { main: [[{ node: "Respond To Platform", type: "main", index: 0 }]] }
  },
  ["publishing", "dry-run"]
);

workflow(
  "03-facebook-instagram-publishing-blocked-draft.json",
  "FF Admin - Facebook Instagram Publishing - Blocked Draft",
  [
    codeNode("guard", "Activation Guard", `
return [{
  json: {
    blocked: true,
    reason: "DO NOT ACTIVATE until Meta permissions, long-lived token, approval validation, public media hosting, duplicate protection, and dry-run tests are complete.",
    meta_called: false
  }
}];
`.trim(), [0, 0], "This workflow is a blocked placeholder only."),
    httpPlaceholder("facebook-placeholder", "Future Facebook Graph API Node - Disabled", [280, -120], "Disabled placeholder. Add credential in n8n only after approval."),
    httpPlaceholder("instagram-container-placeholder", "Future Instagram Container Node - Disabled", [280, 0], "Disabled placeholder. Must not be connected to dry-run path."),
    httpPlaceholder("instagram-publish-placeholder", "Future Instagram Publish Node - Disabled", [280, 120], "Disabled placeholder. Must not be connected before Meta readiness.")
  ],
  {},
  ["publishing", "meta", "blocked"]
);

workflow(
  "04-lead-intake-callback-draft.json",
  "FF Admin - Lead Intake Callback - Draft",
  [
    webhookNode("lead-webhook", "Lead Intake Platform Webhook", "future-foresight/lead-intake"),
    codeNode("normalize", "Normalize Lead Draft", ack("lead_intake")),
    respondNode()
  ],
  {
    "Lead Intake Platform Webhook": { main: [[{ node: "Normalize Lead Draft", type: "main", index: 0 }]] },
    "Normalize Lead Draft": { main: [[{ node: "Respond To Platform", type: "main", index: 0 }]] }
  },
  ["lead-ops", "webhook"]
);

workflow(
  "05-lead-normalization-routing-draft.json",
  "FF Admin - Lead Normalization And Routing - Draft",
  [
    webhookNode("route-webhook", "Lead Routing Webhook", "future-foresight/lead-routing"),
    codeNode("route", "Classify Buyer Supplier Draft", `
const body = $json.body ?? $json;
const text = JSON.stringify(body).toLowerCase();
const inferred = text.includes("supplier") ? "supplier" : "buyer_or_unknown";
return [{ json: { draft: true, inferred_route: inferred, owner_assignment_required: true, external_calls_made: false } }];
`.trim()),
    respondNode()
  ],
  {
    "Lead Routing Webhook": { main: [[{ node: "Classify Buyer Supplier Draft", type: "main", index: 0 }]] },
    "Classify Buyer Supplier Draft": { main: [[{ node: "Respond To Platform", type: "main", index: 0 }]] }
  },
  ["lead-ops"]
);

workflow(
  "06-follow-up-reminders-draft.json",
  "FF Admin - Follow Up Reminders - Draft",
  [
    {
      id: "schedule",
      name: "Schedule Trigger - Disabled Until Ready",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [0, 0],
      disabled: true,
      parameters: { rule: { interval: [{ field: "hours", hoursInterval: 6 }] } },
      notes: "Enable only after lead owner fields and reminder suppression are verified."
    },
    codeNode("reminder-spec", "Reminder Rules Placeholder", "return [{ json: { draft: true, filter: 'lead_status=new AND first_touch_due_at < now AND reminder interval elapsed', external_calls_made: false } }];")
  ],
  { "Schedule Trigger - Disabled Until Ready": { main: [[{ node: "Reminder Rules Placeholder", type: "main", index: 0 }]] } },
  ["lead-ops", "schedule"]
);

workflow(
  "07-weekly-management-report-draft.json",
  "FF Admin - Weekly Management Report - Draft",
  [
    {
      id: "weekly",
      name: "Weekly Schedule - Disabled Until Ready",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [0, 0],
      disabled: true,
      parameters: { rule: { interval: [{ field: "weeks", triggerAtDay: [1], triggerAtHour: 9 }] } },
      notes: "Enable after recipients and report definitions are approved."
    },
    codeNode("report-spec", "Report Sections Placeholder", "return [{ json: { draft: true, sections: ['last_7_days_leads','all_time_leads','overdue_first_touch','qualified_last_7_days','leads_by_source','blockers_attention_needed'], external_calls_made: false } }];")
  ],
  { "Weekly Schedule - Disabled Until Ready": { main: [[{ node: "Report Sections Placeholder", type: "main", index: 0 }]] } },
  ["reporting", "schedule"]
);

workflow(
  "08-knowledge-base-index-sync-draft.json",
  "FF Admin - Knowledge Base Index Sync - Draft",
  [
    webhookNode("kb-sync-webhook", "Platform KB Sync Webhook", "future-foresight/kb-sync"),
    codeNode("sync-plan", "One Way Sync Placeholder", "return [{ json: { draft: true, direction: 'Markdown to platform database only', conflict_handling: 'report_conflicts_do_not_overwrite_markdown', external_calls_made: false } }];"),
    respondNode()
  ],
  {
    "Platform KB Sync Webhook": { main: [[{ node: "One Way Sync Placeholder", type: "main", index: 0 }]] },
    "One Way Sync Placeholder": { main: [[{ node: "Respond To Platform", type: "main", index: 0 }]] }
  },
  ["governance", "knowledge-base"]
);

workflow(
  "09-claim-validation-draft.json",
  "FF Admin - Claim Validation - Draft",
  [
    webhookNode("claim-webhook", "Claim Validation Webhook", "future-foresight/claim-validation"),
    codeNode("claim-check", "Evidence Rule Placeholder", "return [{ json: { draft: true, result: 'requires_evidence_lookup', unsupported_claims_blocked: true, supplier_confidential_blocked: true, external_calls_made: false } }];"),
    respondNode()
  ],
  {
    "Claim Validation Webhook": { main: [[{ node: "Evidence Rule Placeholder", type: "main", index: 0 }]] },
    "Evidence Rule Placeholder": { main: [[{ node: "Respond To Platform", type: "main", index: 0 }]] }
  },
  ["marketing", "governance"]
);

workflow(
  "10-magnific-generation-draft.json",
  "FF Admin - Magnific Generation - Draft",
  [
    webhookNode("magnific-webhook", "Magnific Request Webhook", "future-foresight/magnific-generation"),
    codeNode("guard", "Magnific Guard Placeholder", "return [{ json: { draft: true, magnific_called: false, requires_credit_limit: true, requires_human_review: true } }];"),
    respondNode(),
    httpPlaceholder("magnific-placeholder", "Future Magnific API Node - Disabled", [260, 140], "Disabled placeholder. Add Magnific credential in n8n only after owner approval.")
  ],
  {
    "Magnific Request Webhook": { main: [[{ node: "Magnific Guard Placeholder", type: "main", index: 0 }]] },
    "Magnific Guard Placeholder": { main: [[{ node: "Respond To Platform", type: "main", index: 0 }]] }
  },
  ["marketing", "magnific"]
);

workflow(
  "11-platform-callback-helper-draft.json",
  "FF Admin - Platform Callback Helper - Draft",
  [
    codeNode("callback-spec", "Signed Callback Contract", "return [{ json: { endpoint: '/api/automation/callback', required_headers: ['x-ff-signature','x-ff-timestamp','x-ff-nonce'], requires_hmac_sha256: true, external_calls_made: false } }];")
  ],
  {},
  ["callback", "platform"]
);

workflow(
  "12-dead-letter-and-health-monitoring-draft.json",
  "FF Admin - Dead Letter And Health Monitoring - Draft",
  [
    {
      id: "monitor-schedule",
      name: "Monitor Schedule - Disabled Until Ready",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [0, 0],
      disabled: true,
      parameters: { rule: { interval: [{ field: "minutes", minutesInterval: 30 }] } },
      notes: "Enable after notification channel and platform health endpoint are approved."
    },
    codeNode("health-spec", "Health Rules Placeholder", "return [{ json: { draft: true, checks: ['failed_jobs','missed_callbacks','integration_status','workflow_errors'], external_calls_made: false } }];")
  ],
  { "Monitor Schedule - Disabled Until Ready": { main: [[{ node: "Health Rules Placeholder", type: "main", index: 0 }]] } },
  ["governance", "monitoring"]
);

console.log(`Generated workflow program in ${outDir}`);
