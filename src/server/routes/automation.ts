import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { requirePermission } from "../security/auth.js";
import { signPayload, timingSafeEqual } from "../security/crypto.js";
import { addJobEvent, dispatchJob, transitionJob } from "../services/automation.js";
import { deleteFile, saveFile } from "../services/storage.js";
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

  app.post("/api/automation/callback", { bodyLimit: 10 * 1024 * 1024 }, async (request, reply) => {
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
    const previousNonce = await prisma.automationJobEvent.findFirst({ where: { externalReference: nonce } });
    if (previousNonce) return { ok: true, duplicate: true };
    if (job.correlationId !== input.correlation_id) {
      reply.code(409);
      return { error: "Callback correlation mismatch" };
    }
    const composedFiles = job.jobType === "creative_image_generation" && completedContentStatuses.has(input.status)
      ? (input.files ?? []).filter((file) => file.source === "n8n-sharp-compositor" && typeof file.data_base64 === "string")
      : [];
    const storedCompositions: Array<{
      descriptor: Record<string, unknown>;
      stored: Awaited<ReturnType<typeof saveFile>>;
    }> = [];
    try {
      for (const [index, composedFile] of composedFiles.entries()) {
        const buffer = Buffer.from(String(composedFile.data_base64), "base64");
        if (!buffer.length) throw new Error(`Composed image ${index + 1} payload is empty`);
        const mimeType = String(composedFile.mime_type || "image/jpeg");
        const name = String(composedFile.name || `creative-${job.id}-${index + 1}.jpg`);
        const stored = await saveFile(buffer, name, mimeType);
        storedCompositions.push({ descriptor: composedFile, stored });
      }
    } catch (error) {
      await Promise.all(storedCompositions.map(({ stored }) => deleteFile(stored.storageKey).catch(() => undefined)));
      throw error;
    }
    const newStatus = input.status.toUpperCase() as any;
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
      const existingNonce = await tx.automationJobEvent.findFirst({ where: { externalReference: nonce } });
      if (existingNonce) return { duplicate: true, contentItemId: undefined as string | undefined, creativeAssetId: undefined as string | undefined, creativeAssetIds: [] as string[] };

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
          payloadSummary: { warnings: input.warnings, files: input.files?.map((file) => ({ ...file, data_base64: undefined })), error: input.error } as Prisma.InputJsonValue,
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

      let creativeAssetId: string | undefined;
      let creativeAssetIds: string[] = [];
      if (["creative_image_generation", "creative_video_generation"].includes(currentJob.jobType) && currentJob.contentRequestId) {
        if (completedContentStatuses.has(input.status)) {
          const existingMaterialization = await tx.automationJobEvent.findFirst({ where: { jobId: currentJob.id, eventType: "creative_result_materialized" } });
          if (existingMaterialization) {
            const existingAssets = await tx.creativeAsset.findMany({
              where: { contentRequestId: currentJob.contentRequestId, metadata: { path: "$.automationJobId", equals: currentJob.id } },
              select: { id: true }
            });
            creativeAssetIds = existingAssets.map((asset) => asset.id);
            creativeAssetId = existingMaterialization.externalReference ?? creativeAssetIds[0];
          } else {
            const outputFiles = Array.isArray((input.outputs as Record<string, unknown> | undefined)?.files)
              ? (input.outputs as Record<string, unknown>).files as Record<string, unknown>[]
              : [];
            const fallbackFile = input.files?.[0] ?? outputFiles[0] ?? null;
            const materializations = storedCompositions.length
              ? storedCompositions.map(({ descriptor, stored }) => ({ descriptor, stored }))
              : [{ descriptor: fallbackFile, stored: null }];

            for (const [index, materialization] of materializations.entries()) {
              const storedFile = materialization.stored ? await tx.fileObject.create({ data: {
                storageKey: materialization.stored.storageKey,
                originalName: materialization.stored.originalName,
                mimeType: materialization.stored.mimeType,
                sizeBytes: materialization.stored.sizeBytes,
                sha256Hash: materialization.stored.sha256Hash,
                assetType: "image",
                visibilityScope: "INTERNAL",
                approvalStatus: "not_approved"
              } }) : null;
              const safeFile = materialization.descriptor
                ? { ...materialization.descriptor, data_base64: undefined }
                : null;
              const asset = await tx.creativeAsset.create({ data: {
                contentRequestId: currentJob.contentRequestId,
                fileId: storedFile?.id ?? null,
                assetType: currentJob.jobType === "creative_video_generation" ? "video" : "image",
                status: "ready_for_review",
                approvalStatus: "not_approved",
                sourceTool: storedFile ? "n8n-sharp-compositor" : "n8n",
                metadata: {
                  automationJobId: currentJob.id,
                  imageSetPosition: index + 1,
                  imageSetSize: materializations.length,
                  file: safeFile,
                  output: input.outputs ?? {}
                } as Prisma.InputJsonValue
              } });
              creativeAssetIds.push(asset.id);
            }

            creativeAssetId = creativeAssetIds[0];
            await tx.contentRequest.update({ where: { id: currentJob.contentRequestId }, data: { status: "APPROVED_INTERNAL" } });
            await tx.automationJobEvent.create({ data: {
              jobId: currentJob.id,
              eventType: "creative_result_materialized",
              message: creativeAssetIds.length === 1 ? "Creative output saved for human review" : `${creativeAssetIds.length} creative outputs saved for human review`,
              payloadSummary: { creativeAssetIds } as Prisma.InputJsonValue,
              externalReference: creativeAssetId
            } });
          }
        } else if (input.status === "failed") {
          await tx.contentRequest.update({ where: { id: currentJob.contentRequestId }, data: { status: "FAILED" } });
        }
      }

      if (currentJob.jobType.startsWith("publish_")) {
        const output = input.outputs && typeof input.outputs === "object" && !Array.isArray(input.outputs)
          ? input.outputs as Record<string, unknown>
          : {};
        const isDryRun = output.dry_run === true;
        const platformPostId = optionalString(output.platform_post_id) || optionalString(output.platformPostId) || optionalString(output.post_id) || optionalString(output.id);
        const platformUrl = optionalString(output.platform_url) || optionalString(output.platformUrl) || optionalString(output.permalink_url);

        await tx.publishingRecord.updateMany({
          where: { automationJobId: currentJob.id },
          data: completedContentStatuses.has(input.status)
            ? {
                status: isDryRun ? "DRY_RUN" : "PUBLISHED",
                platformPostId,
                platformUrl,
                publishedAt: isDryRun ? undefined : new Date(),
                warnings: input.warnings as Prisma.InputJsonValue | undefined,
                errors: undefined
              }
            : input.status === "failed"
              ? {
                  status: "FAILED",
                  warnings: input.warnings as Prisma.InputJsonValue | undefined,
                  errors: (input.error ? { error: input.error } : { message: input.current_step ?? "Publishing failed" }) as Prisma.InputJsonValue
                }
              : {
                  warnings: input.warnings as Prisma.InputJsonValue | undefined
                }
        });
      }
      return { duplicate: false, contentItemId, creativeAssetId, creativeAssetIds };
      });
    } catch (error) {
      await Promise.all(storedCompositions.map(({ stored }) => deleteFile(stored.storageKey).catch(() => undefined)));
      throw error;
    }

    if (storedCompositions.length && !result.creativeAssetIds.length) {
      await Promise.all(storedCompositions.map(({ stored }) => deleteFile(stored.storageKey).catch(() => undefined)));
    }
    if (result.duplicate) return { ok: true, duplicate: true };
    return { ok: true, content_item_id: result.contentItemId, creative_asset_id: result.creativeAssetId, creative_asset_ids: result.creativeAssetIds };
  });
}
