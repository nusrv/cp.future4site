import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { config } from "../config.js";
import { requirePermission } from "../security/auth.js";
import { audit } from "../services/audit.js";
import { createAutomationJob, dispatchJob } from "../services/automation.js";
import { contentRequestSchema } from "../../shared/contracts.js";

export async function contentRoutes(app: FastifyInstance) {
  app.get("/api/content/requests", { preHandler: requirePermission("content.read") }, async () => {
    const requests = await prisma.contentRequest.findMany({
      include: { items: { orderBy: { version: "desc" }, take: 1 }, assets: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return { requests };
  });

  app.post("/api/content/requests", { preHandler: requirePermission("content.write") }, async (request) => {
    const current = request.currentUser!;
    const input = contentRequestSchema.parse(request.body);
    const created = await prisma.contentRequest.create({
      data: {
        topic: input.topic,
        brand: input.brand,
        businessLine: input.businessLine,
        product: input.product,
        market: input.market,
        audience: input.audience,
        objective: input.objective,
        channel: input.channel,
        format: input.format,
        cta: input.cta,
        internalNotes: input.internalNotes,
        requestedPublishingChannels: input.requestedPublishingChannels,
        createdByUserId: current.user.id
      }
    });
    await audit({ actorUserId: current.user.id, action: "content.request_created", entityType: "content_request", entityId: created.id, summary: "Content request created" });
    return { request: created };
  });

  app.get("/api/content/requests/:id", { preHandler: requirePermission("content.read") }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const item = await prisma.contentRequest.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        items: { orderBy: { version: "desc" } },
        assets: true
      }
    });
    const jobs = await prisma.automationJob.findMany({ where: { contentRequestId: params.id }, include: { events: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } });
    const approvals = await prisma.approval.findMany({ where: { entityId: params.id }, orderBy: { createdAt: "desc" } });
    return { request: item, jobs, approvals };
  });

  app.post("/api/content/requests/:id/generate", { preHandler: requirePermission("content.write") }, async (request) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const content = await prisma.contentRequest.findUniqueOrThrow({ where: { id: params.id } });
    await prisma.contentRequest.update({ where: { id: content.id }, data: { status: "SUBMITTED" } });
    const job = await createAutomationJob({
      jobType: "content_generation",
      title: `Generate content: ${content.topic.slice(0, 80)}`,
      workflowName: config.N8N_CONTENT_WEBHOOK_PATH,
      relatedEntityType: "content_request",
      relatedEntityId: content.id,
      contentRequestId: content.id,
      requestedByUserId: current.user.id,
      idempotencyKey: `content:${content.id}:generation:${Date.now()}`,
      inputPayload: {
        topic: content.topic,
        brand: content.brand,
        businessLine: content.businessLine,
        product: content.product,
        market: content.market,
        audience: content.audience,
        objective: content.objective,
        format: content.format,
        cta: content.cta
      }
    });
    await dispatchJob(job.id);
    const refreshed = await prisma.automationJob.findUniqueOrThrow({ where: { id: job.id } });
    if (refreshed.currentStatus === "COMPLETED") {
      const output = refreshed.outputPayload as any;
      await prisma.contentItem.create({
        data: {
          contentRequestId: content.id,
          version: (await prisma.contentItem.count({ where: { contentRequestId: content.id } })) + 1,
          headline: output?.headline,
          caption: output?.caption,
          cta: output?.cta,
          hashtags: Array.isArray(output?.hashtags) ? output.hashtags.join(" ") : "",
          status: "AWAITING_REVIEW",
          metadata: output
        }
      });
      await prisma.contentRequest.update({ where: { id: content.id }, data: { status: "AWAITING_REVIEW" } });
    }
    await audit({ actorUserId: current.user.id, action: "content.generation_requested", entityType: "content_request", entityId: content.id, summary: "Content generation requested" });
    return { job: refreshed };
  });

  app.post("/api/content/requests/:id/review", { preHandler: requirePermission("content.review") }, async (request) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = z.object({
      decision: z.enum(["approved_internal", "approved_publication", "rejected", "revision_requested", "archived"]),
      notes: z.string().optional()
    }).parse(request.body);
    const statusMap: Record<string, any> = {
      approved_internal: "APPROVED_INTERNAL",
      approved_publication: "APPROVED_PUBLICATION",
      rejected: "REJECTED",
      revision_requested: "REVISION_REQUESTED",
      archived: "ARCHIVED"
    };
    const updated = await prisma.contentRequest.update({ where: { id: params.id }, data: { status: statusMap[input.decision] } });
    await prisma.approval.create({
      data: {
        entityType: "content_request",
        entityId: params.id,
        approvalType: input.decision.includes("publication") ? "publication" : "content",
        status: input.decision,
        decidedByUserId: current.user.id,
        decisionNotes: input.notes,
        decidedAt: new Date()
      }
    });
    let creativeJob = null;
    if (input.decision === "approved_publication") {
      creativeJob = await requestCreativeProduction(updated.id, current.user.id);
    }
    await audit({ actorUserId: current.user.id, action: `content.${input.decision}`, entityType: "content_request", entityId: params.id, summary: `Content review: ${input.decision}` });
    return { request: updated, creativeJob };
  });

  app.post("/api/content/items/:id/publish", { preHandler: requirePermission("publishing.request") }, async (request) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = z.object({ platforms: z.array(z.enum(["facebook", "instagram"])).min(1), dryRun: z.boolean().default(true) }).parse(request.body);
    const item = await prisma.contentItem.findUniqueOrThrow({ where: { id: params.id }, include: { request: true } });
    if (item.request.status !== "APPROVED_PUBLICATION") throw new Error("Content is not approved for publication");
    const records = [];
    for (const platform of input.platforms) {
      const job = await createAutomationJob({
        jobType: `publish_${platform}`,
        title: `${input.dryRun ? "Dry-run" : "Publish"} ${platform}`,
        workflowName: config.N8N_PUBLISH_WEBHOOK_PATH,
        relatedEntityType: "content_item",
        relatedEntityId: item.id,
        requestedByUserId: current.user.id,
        idempotencyKey: `publish:${platform}:${item.id}:${input.dryRun ? "dry" : "live"}`,
        inputPayload: {
          platform,
          dryRun: input.dryRun,
          caption: item.caption,
          headline: item.headline,
          cta: item.cta
        }
      });
      await dispatchJob(job.id);
      const record = await prisma.publishingRecord.upsert({
        where: { idempotencyKey: `publish:${platform}:${item.id}:${input.dryRun ? "dry" : "live"}` },
        update: { status: input.dryRun ? "DRY_RUN" : "QUEUED", automationJobId: job.id },
        create: {
          contentItemId: item.id,
          platform: platform.toUpperCase() as any,
          status: input.dryRun ? "DRY_RUN" : "QUEUED",
          mode: input.dryRun ? "DRY_RUN" : "MOCK",
          idempotencyKey: `publish:${platform}:${item.id}:${input.dryRun ? "dry" : "live"}`,
          automationJobId: job.id,
          requestedByUserId: current.user.id
        }
      });
      records.push(record);
    }
    await audit({ actorUserId: current.user.id, action: "publishing.requested", entityType: "content_item", entityId: item.id, summary: `Publishing requested for ${input.platforms.join(", ")}` });
    return { records };
  });
}

async function requestCreativeProduction(contentRequestId: string, requestedByUserId: string) {
  const content = await prisma.contentRequest.findUniqueOrThrow({
    where: { id: contentRequestId },
    include: { items: { orderBy: { version: "desc" }, take: 1 }, assets: true }
  });
  const latestItem = content.items[0];
  const creativeType = getCreativeWorkflowType(content.format);
  if (!creativeType) return null;

  const workflowName = creativeType === "creative_video_generation"
    ? config.N8N_CREATIVE_VIDEO_WEBHOOK_PATH
    : config.N8N_CREATIVE_IMAGE_WEBHOOK_PATH;
  const job = await createAutomationJob({
    jobType: creativeType,
    title: `${creativeType === "creative_video_generation" ? "Generate video" : "Generate image"}: ${content.topic.slice(0, 80)}`,
    workflowName,
    relatedEntityType: "content_request",
    relatedEntityId: content.id,
    contentRequestId: content.id,
    requestedByUserId,
    idempotencyKey: `creative:${creativeType}:${content.id}`,
    inputPayload: {
      content_request_id: content.id,
      content_item_id: latestItem?.id ?? null,
      format: content.format,
      brand: content.brand,
      business_line: content.businessLine,
      product: content.product,
      market: content.market,
      audience: content.audience,
      objective: content.objective,
      channel: content.channel,
      requested_publishing_channels: content.requestedPublishingChannels,
      headline: latestItem?.headline ?? null,
      caption: latestItem?.caption ?? null,
      cta: latestItem?.cta ?? content.cta ?? null,
      hashtags: latestItem?.hashtags ?? null,
      approval_status: "approved_publication",
      human_review_required: true
    }
  });

  try {
    await dispatchJob(job.id);
  } catch (error) {
    await audit({
      actorUserId: requestedByUserId,
      action: "content.creative_workflow_dispatch_failed",
      entityType: "content_request",
      entityId: content.id,
      summary: error instanceof Error ? error.message : "Creative workflow dispatch failed"
    });
  }
  return prisma.automationJob.findUnique({ where: { id: job.id } });
}

function getCreativeWorkflowType(format: string) {
  if (format === "text_video") return "creative_video_generation";
  if (format === "text_image" || format === "carousel") return "creative_image_generation";
  return null;
}
