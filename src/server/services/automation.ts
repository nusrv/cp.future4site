import { nanoid } from "nanoid";
import { AutomationStatus, type Prisma } from "@prisma/client";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { signPayload } from "../security/crypto.js";

type CreateJobInput = {
  jobType: string;
  title: string;
  workflowName: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  contentRequestId?: string;
  requestedByUserId?: string;
  inputPayload: Record<string, unknown>;
  idempotencyKey: string;
};

export async function createAutomationJob(input: CreateJobInput) {
  const existing = await prisma.automationJob.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return existing;
  const correlationId = `corr_${nanoid(24)}`;
  const job = await prisma.automationJob.create({
    data: {
      jobType: input.jobType,
      title: input.title,
      workflowName: input.workflowName,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      contentRequestId: input.contentRequestId,
      requestedByUserId: input.requestedByUserId,
      inputPayload: input.inputPayload as Prisma.InputJsonValue,
      idempotencyKey: input.idempotencyKey,
      correlationId,
      currentStatus: "QUEUED"
    }
  });
  await addJobEvent(job.id, "created", null, "QUEUED", "Job created");
  return job;
}

export async function addJobEvent(
  jobId: string,
  eventType: string,
  previousStatus: AutomationStatus | null,
  newStatus: AutomationStatus | null,
  message: string,
  payloadSummary?: unknown
) {
  await prisma.automationJobEvent.create({
    data: {
      jobId,
      eventType,
      previousStatus: previousStatus ?? undefined,
      newStatus: newStatus ?? undefined,
      message,
      payloadSummary: payloadSummary as Prisma.InputJsonValue | undefined
    }
  });
}

export async function transitionJob(jobId: string, status: AutomationStatus, message: string, data?: Record<string, unknown>) {
  const job = await prisma.automationJob.findUniqueOrThrow({ where: { id: jobId } });
  const updated = await prisma.automationJob.update({
    where: { id: jobId },
    data: {
      currentStatus: status,
      currentStep: message,
      outputPayload: data?.outputPayload as Prisma.InputJsonValue | undefined,
      errorCode: data?.errorCode as string | undefined,
      errorMessage: data?.errorMessage as string | undefined,
      creditCost: data?.creditCost as number | undefined,
      completedAt: ["COMPLETED", "COMPLETED_WITH_WARNINGS", "FAILED", "CANCELLED"].includes(status) ? new Date() : undefined
    }
  });
  await addJobEvent(jobId, "status_changed", job.currentStatus, status, message, data);
  return updated;
}

export async function dispatchJob(jobId: string) {
  const job = await prisma.automationJob.findUniqueOrThrow({ where: { id: jobId } });
  if (config.INTEGRATION_MODE === "mock" || !config.N8N_LIVE_ENABLED) {
    await transitionJob(job.id, "RUNNING", "Mock adapter running");
    const mockOutput = buildMockOutput(job.jobType, job.inputPayload as Record<string, unknown>);
    await transitionJob(job.id, "COMPLETED", "Mock adapter completed", {
      outputPayload: mockOutput,
      creditCost: 0
    });
    return { mode: "mock", jobId: job.id };
  }

  const timestamp = new Date().toISOString();
  const nonce = nanoid(24);
  const body = JSON.stringify({
    job_id: job.id,
    correlation_id: job.correlationId,
    idempotency_key: job.idempotencyKey,
    workflow_type: job.jobType,
    workflow_version: job.workflowVersion,
    requested_by_user_id: job.requestedByUserId,
    created_at: job.createdAt.toISOString(),
    callback_url: `${config.APP_BASE_URL}/api/automation/callback`,
    signature_timestamp: timestamp,
    nonce,
    payload: job.inputPayload
  });
  const signature = signPayload(config.N8N_WEBHOOK_SECRET, timestamp, nonce, body);
  await transitionJob(job.id, "SUBMITTED", "Submitting to n8n");
  const webhookBasePath = config.N8N_WEBHOOK_BASE_PATH.replace(/^\/|\/$/g, "");
  const workflowPath = job.workflowName.replace(/^\/|\/$/g, "");
  const url = `${config.N8N_BASE_URL.replace(/\/$/, "")}/${webhookBasePath}/${workflowPath}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ff-signature": signature,
        "x-ff-timestamp": timestamp,
        "x-ff-nonce": nonce
      },
      body
    });
  } catch (error) {
    await transitionJob(job.id, "FAILED", "n8n webhook network error", {
      errorCode: "N8N_NETWORK_ERROR",
      errorMessage: error instanceof Error ? error.message : "Unknown network error"
    });
    const upstreamError = new Error("n8n webhook network error");
    (upstreamError as Error & { statusCode: number }).statusCode = 502;
    throw upstreamError;
  }
  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    const detail = `${response.status} ${response.statusText}${responseText ? ` - ${responseText.slice(0, 300)}` : ""}`;
    await transitionJob(job.id, "FAILED", "n8n webhook submission failed", { errorCode: "N8N_SUBMIT_FAILED", errorMessage: detail });
    const upstreamError = new Error(`n8n webhook submission failed: ${detail}`);
    (upstreamError as Error & { statusCode: number }).statusCode = 502;
    throw upstreamError;
  }
  await transitionJob(job.id, "WAITING_FOR_CALLBACK", "n8n acknowledged request");
  return { mode: config.INTEGRATION_MODE, jobId: job.id };
}

function buildMockOutput(jobType: string, payload: Record<string, unknown>) {
  if (jobType.includes("publish")) {
    return {
      platformStatus: "mock_published",
      platformPostId: `mock_${nanoid(10)}`,
      platformUrl: "https://example.com/mock-published-post",
      warnings: ["Mock mode: no external platform was called."]
    };
  }
  return {
    headline: "Future Oils Internal Draft",
    caption: `Synthetic generated copy for ${(payload.topic as string) || "content request"}. This is mock output for review only.`,
    cta: (payload.cta as string) || "Request a Quote",
    hashtags: ["#FutureOils", "#B2BTrade"],
    files: [
      {
        file_id: `mock_file_${nanoid(8)}`,
        type: "image",
        url: "mock://generated/future-oils-concept.png",
        width: 1080,
        height: 1350
      }
    ],
    evidence_references: [
      {
        source_file: "knowledge-base/company.md",
        source_section: "Brands"
      }
    ],
    warnings: ["Mock generation: validate all claims before publication."],
    credit_usage: 0
  };
}
