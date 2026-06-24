import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { requirePermission } from "../security/auth.js";
import { signPayload, timingSafeEqual } from "../security/crypto.js";
import { addJobEvent, dispatchJob, transitionJob } from "../services/automation.js";
import { automationCallbackSchema } from "../../shared/contracts.js";

const completedContentStatuses = new Set(["completed", "completed_with_warnings"]);

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function formatHashtags(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").join(" ");
  return "";
}

export async function automationRoutes(app: FastifyInstance) {
  app.get("/api/automation/jobs", { preHandler: requirePermission("automation.read") }, async (request) => {
    const query = z.object({ status: z.string().optional() }).parse(request.query);
    const jobs = await prisma.automationJob.findMany({
      where: query.status ? { currentStatus: query.status as any } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return { jobs };
  });

  app.get("/api/automation/jobs/:id", { preHandler: requirePermission("automation.read") }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const job = await prisma.automationJob.findUniqueOrThrow({
      where: { id: params.id },
      include: { events: { orderBy: { createdAt: "asc" } } }
    });
    return { job };
  });

  app.post("/api/automation/jobs/:id/retry", { preHandler: requirePermission("automation.retry") }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    await prisma.automationJob.update({ where: { id: params.id }, data: { retryCount: { increment: 1 }, currentStatus: "QUEUED" } });
    await addJobEvent(params.id, "retry_requested", "FAILED", "QUEUED", "Retry requested by user");
    return dispatchJob(params.id);
  });

  app.post("/api/automation/jobs/:id/cancel", { preHandler: requirePermission("automation.retry") }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    await transitionJob(params.id, "CANCELLED", "Cancelled by user");
    return { ok: true };
  });

  app.post("/api/automation/callback", async (request, reply) => {
    const raw = JSON.stringify(request.body ?? {});
    const signature = String(request.headers["x-ff-signature"] ?? "");
    const timestamp = String(request.headers["x-ff-timestamp"] ?? "");
    const nonce = String(request.headers["x-ff-nonce"] ?? "");
    if (!signature || !timestamp || !nonce) {
      reply.code(401);
      return { error: "Missing callback signature" };
    }
    const expected = signPayload(config.PLATFORM_CALLBACK_SECRET, timestamp, nonce, raw);
    if (!timingSafeEqual(signature, expected)) {
      reply.code(401);
      return { error: "Invalid callback signature" };
    }
    const drift = Math.abs(Date.now() - Date.parse(timestamp));
    if (!Number.isFinite(drift) || drift > 5 * 60 * 1000) {
      reply.code(401);
      return { error: "Callback timestamp rejected" };
    }

    const input = automationCallbackSchema.parse(request.body);
    const job = await prisma.automationJob.findUniqueOrThrow({ where: { id: input.job_id } });
    if (job.correlationId !== input.correlation_id) {
      reply.code(409);
      return { error: "Callback correlation mismatch" };
    }

    const newStatus = input.status.toUpperCase() as any;
    const result = await prisma.$transaction(async (tx) => {
      const existingNonce = await tx.automationJobEvent.findFirst({ where: { externalReference: nonce } });
      if (existingNonce) return { duplicate: true, contentItemId: undefined as string | undefined };

      const currentJob = await tx.automationJob.findUniqueOrThrow({ where: { id: input.job_id } });
      await tx.automationJob.update({
        where: { id: currentJob.id },
        data: {
          currentStatus: newStatus,
          currentStep: input.current_step,
          outputPayload: input.outputs as Prisma.InputJsonValue | undefined,
          errorCode: input.error?.code,
          errorMessage: input.error?.message,
          creditCost: input.cost?.credits,
          completedAt: ["completed", "completed_with_warnings", "failed", "cancelled"].includes(input.status) ? new Date() : undefined
        }
      });
      await tx.automationJobEvent.create({
        data: {
          jobId: currentJob.id,
          eventType: "callback_received",
          previousStatus: currentJob.currentStatus,
          newStatus,
          message: input.current_step ?? `Callback: ${input.status}`,
          payloadSummary: { warnings: input.warnings, files: input.files, error: input.error } as Prisma.InputJsonValue,
          externalReference: nonce
        }
      });

      let contentItemId: string | undefined;
      if (currentJob.jobType === "content_generation" && currentJob.contentRequestId) {
        if (completedContentStatuses.has(input.status)) {
          const existingMaterialization = await tx.automationJobEvent.findFirst({
            where: { jobId: currentJob.id, eventType: "content_result_materialized" }
          });
          if (existingMaterialization) {
            contentItemId = existingMaterialization.externalReference ?? undefined;
          } else {
            const output = input.outputs ?? {};
            const version = (await tx.contentItem.count({ where: { contentRequestId: currentJob.contentRequestId } })) + 1;
            const item = await tx.contentItem.create({
              data: {
                contentRequestId: currentJob.contentRequestId,
                version,
                headline: optionalString(output.headline),
                caption: optionalString(output.caption),
                cta: optionalString(output.cta),
                hashtags: formatHashtags(output.hashtags),
                status: "AWAITING_REVIEW",
                metadata: output as Prisma.InputJsonValue
              }
            });
            contentItemId = item.id;
            await tx.contentRequest.update({
              where: { id: currentJob.contentRequestId },
              data: { status: "AWAITING_REVIEW" }
            });
            await tx.automationJobEvent.create({
              data: {
                jobId: currentJob.id,
                eventType: "content_result_materialized",
                message: "n8n output saved as a content item",
                payloadSummary: { contentItemId: item.id, contentRequestId: currentJob.contentRequestId } as Prisma.InputJsonValue,
                externalReference: item.id
              }
            });
          }
        } else if (input.status === "failed") {
          await tx.contentRequest.update({
            where: { id: currentJob.contentRequestId },
            data: { status: "FAILED" }
          });
        }
      }

      return { duplicate: false, contentItemId };
    });

    if (result.duplicate) return { ok: true, duplicate: true };
    return { ok: true, content_item_id: result.contentItemId };
  });
}
