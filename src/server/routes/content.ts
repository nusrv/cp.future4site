import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { config } from "../config.js";
import { requirePermission } from "../security/auth.js";
import { signPayload } from "../security/crypto.js";
import { audit } from "../services/audit.js";
import { createAutomationJob, dispatchJob } from "../services/automation.js";
import { getPublishingCapabilities } from "../services/publishingCapabilities.js";
import { readFile, saveFile } from "../services/storage.js";
import { contentRequestSchema } from "../../shared/contracts.js";
import { getUnavailablePublishingPlatform } from "../../shared/publishingCapabilities.js";
import { buildContentEvidence, evidenceClaimIds, validateEvidenceReferences } from "../services/knowledgeEvidence.js";

export async function contentRoutes(app: FastifyInstance) {
  app.get("/api/content/publishing-capabilities", { preHandler: requirePermission("publishing.request") }, async () => {
    return getPublishingCapabilities();
  });

  app.get("/api/content/creative-options", { preHandler: requirePermission("content.read") }, async () => {
    const profilePath = path.resolve(process.cwd(), "public", "assets", "brand-profile.json");
    const profile = JSON.parse(await fs.readFile(profilePath, "utf8")) as Record<string, any>;
    const backgrounds = Object.entries(profile.template_backgrounds || {}).map(([id, value]) => {
      const entry = typeof value === "string" ? { file: value } : value as Record<string, unknown>;
      return {
        id,
        label: typeof entry.label === "string" ? entry.label : id,
        description: typeof entry.description === "string" ? entry.description : undefined,
        file: typeof entry.file === "string" ? entry.file : value
      };
    });
    return { backgrounds };
  });

  app.get("/api/content/requests", { preHandler: requirePermission("content.read") }, async () => {
    const requests = await prisma.contentRequest.findMany({
      include: { items: { orderBy: { version: "desc" }, take: 1, include: { publishingRecords: true } }, assets: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    const jobs = requests.length ? await prisma.automationJob.findMany({
      where: { contentRequestId: { in: requests.map((item) => item.id) } }, orderBy: { createdAt: "desc" }
    }) : [];
    return { requests: requests.map((item) => ({ ...item, jobs: jobs.filter((job) => job.contentRequestId === item.id) })) };
  });

  app.post("/api/content/requests", { preHandler: requirePermission("content.write") }, async (request) => {
    const current = request.currentUser!;
    const input = contentRequestSchema.parse(request.body);
    const created = await prisma.contentRequest.create({
      data: {
        topic: input.topic,
        brand: input.brand,
        businessLine: input.businessLine.trim() || input.brand,
        product: input.product,
        locale: input.locale,
        market: input.market,
        audience: input.audience,
        objective: input.objective,
        channel: input.channel,
        format: input.format,
        cta: input.cta,
        creativeTemplateId: input.creativeTemplateId,
        internalNotes: input.internalNotes,
        requestedPublishingChannels: input.requestedPublishingChannels,
        createdByUserId: current.user.id
      }
    });
    try {
      await audit({ actorUserId: current.user.id, action: "content.request_created", entityType: "content_request", entityId: created.id, summary: "Content request created" });
    } catch (error) {
      request.log.error({ error, contentRequestId: created.id }, "Content request was created but its audit event could not be recorded");
    }
    return { request: created };
  });

  app.get("/api/content/requests/:id", { preHandler: requirePermission("content.read") }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const item = await prisma.contentRequest.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        items: { orderBy: { version: "desc" } },
        assets: { orderBy: { createdAt: "desc" } }
      }
    });
    const jobs = await prisma.automationJob.findMany({ where: { contentRequestId: params.id }, include: { events: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } });
    const approvals = await prisma.approval.findMany({ where: { entityId: params.id }, orderBy: { createdAt: "desc" } });
    return { request: item, jobs, approvals };
  });

  app.get("/api/content/requests/:id/evidence", { preHandler: requirePermission("content.read") }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const bundles = await prisma.knowledgeEvidenceBundle.findMany({
      where: { contentRequestId: id },
      select: {
        id: true,
        resolutionId: true,
        locale: true,
        context: true,
        claims: true,
        claimCount: true,
        automationJobId: true,
        createdAt: true,
        createdBy: { select: { displayName: true, username: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    return { bundles };
  });

  app.post("/api/content/requests/:id/generate", { preHandler: requirePermission("content.write") }, async (request) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const content = await prisma.contentRequest.findUniqueOrThrow({ where: { id: params.id } });
    const evidence = config.KNOWLEDGE_GENERATION_ENABLED ? await buildContentEvidence(content) : null;
    const evidenceBundle = evidence ? await prisma.knowledgeEvidenceBundle.create({ data: {
      contentRequestId: content.id,
      resolutionId: evidence.resolution.resolutionId,
      locale: content.locale,
      context: evidence.resolution.context,
      claims: evidence.payload.claims,
      claimCount: evidence.payload.claims.length,
      createdByUserId: current.user.id
    } }) : null;
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
        cta: content.cta,
        ...(evidence ? { knowledge_evidence: evidence.payload } : {})
      }
    });
    if (evidenceBundle) {
      await prisma.knowledgeEvidenceBundle.update({ where: { id: evidenceBundle.id }, data: { automationJobId: job.id } });
    }
    await prisma.contentRequest.update({ where: { id: content.id }, data: { status: "SUBMITTED" } });
    await dispatchJob(job.id);
    const refreshed = await prisma.automationJob.findUniqueOrThrow({ where: { id: job.id } });
    if (refreshed.currentStatus === "COMPLETED") {
      const output = refreshed.outputPayload as any;
      if (evidenceBundle && evidence) validateEvidenceReferences(output ?? {}, evidenceClaimIds(evidence.payload.claims));
      await prisma.contentItem.create({
        data: {
          contentRequestId: content.id,
          version: (await prisma.contentItem.count({ where: { contentRequestId: content.id } })) + 1,
          headline: output?.headline,
          caption: output?.caption,
          cta: output?.cta,
          hashtags: Array.isArray(output?.hashtags) ? output.hashtags.join(" ") : "",
          status: "AWAITING_REVIEW",
          metadata: evidenceBundle && evidence ? { ...output, knowledgeEvidenceBundleId: evidenceBundle.id, resolutionId: evidence.resolution.resolutionId } : output
        }
      });
      await prisma.contentRequest.update({ where: { id: content.id }, data: { status: "AWAITING_REVIEW" } });
    }
    await audit({
      actorUserId: current.user.id,
      action: "content.generation_requested",
      entityType: "content_request",
      entityId: content.id,
      summary: "Content generation requested",
      metadata: evidenceBundle && evidence ? { evidenceBundleId: evidenceBundle.id, resolutionId: evidence.resolution.resolutionId, claimIds: evidenceClaimIds(evidence.payload.claims) } : undefined
    });
    return { job: refreshed };
  });

  app.patch("/api/content/items/:id", { preHandler: requirePermission("content.write") }, async (request) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = z.object({
      headline: z.string().trim().max(300).nullable().optional(),
      caption: z.string().trim().min(1).max(10000),
      cta: z.string().trim().max(300).nullable().optional(),
      hashtags: z.string().trim().max(2000).nullable().optional()
    }).parse(request.body);
    const item = await prisma.contentItem.findUniqueOrThrow({
      where: { id: params.id },
      include: { request: true, publishingRecords: true }
    });
    if (item.publishingRecords.length) throw new Error("Published or queued copy cannot be edited");
    if (["APPROVED_PUBLICATION", "ARCHIVED"].includes(item.request.status)) throw new Error("This request is no longer editable");
    const existingMetadata = item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) ? item.metadata : {};
    const updated = await prisma.contentItem.update({
      where: { id: item.id },
      data: {
        headline: input.headline || null,
        caption: input.caption,
        cta: input.cta || null,
        hashtags: input.hashtags || null,
        status: "AWAITING_REVIEW",
        metadata: { ...existingMetadata, manuallyEdited: true, manuallyEditedAt: new Date().toISOString(), manuallyEditedByUserId: current.user.id }
      }
    });
    await prisma.contentRequest.update({ where: { id: item.contentRequestId }, data: { status: "AWAITING_REVIEW" } });
    await audit({ actorUserId: current.user.id, action: "content.copy_edited", entityType: "content_item", entityId: item.id, summary: "Generated copy edited manually" });
    return { item: updated };
  });

  app.post("/api/content/requests/:id/assets/upload", { preHandler: requirePermission("content.write") }, async (request) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const content = await prisma.contentRequest.findUniqueOrThrow({ where: { id: params.id } });
    if (!["text_image", "carousel"].includes(content.format)) throw new Error("Manual image upload is available only for image and carousel requests");
    if (["APPROVED_PUBLICATION", "ARCHIVED"].includes(content.status)) throw new Error("This request no longer accepts replacement images");
    const part = await request.file();
    if (!part) throw new Error("Choose an image to upload");
    if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(part.mimetype)) throw new Error("Upload a PNG, JPEG, or WebP image");
    const stored = await saveFile(await part.toBuffer(), part.filename, part.mimetype);
    const file = await prisma.fileObject.create({ data: {
      storageKey: stored.storageKey,
      originalName: stored.originalName,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      sha256Hash: stored.sha256Hash,
      assetType: "image",
      visibilityScope: "INTERNAL",
      approvalStatus: "not_approved",
      createdByUserId: current.user.id
    } });
    const [, asset] = await prisma.$transaction([
      prisma.creativeAsset.updateMany({ where: { contentRequestId: content.id, approvalStatus: { not: "approved" } }, data: { status: "superseded", approvalStatus: "rejected" } }),
      prisma.creativeAsset.create({ data: {
        contentRequestId: content.id,
        fileId: file.id,
        assetType: "image",
        status: "ready_for_review",
        approvalStatus: "not_approved",
        sourceTool: "manual_upload",
        visibilityScope: "INTERNAL",
        metadata: { originalName: stored.originalName, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes, source: "manual_upload" }
      } }),
      prisma.contentRequest.update({ where: { id: content.id }, data: { status: "APPROVED_INTERNAL" } })
    ]);
    await audit({ actorUserId: current.user.id, action: "creative.uploaded", entityType: "creative_asset", entityId: asset.id, summary: "Creative image uploaded manually" });
    return { asset };
  });

  app.get("/api/content/assets/:id/file", { preHandler: requirePermission("content.read") }, async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const asset = await prisma.creativeAsset.findUniqueOrThrow({ where: { id: params.id } });
    if (!asset.fileId) throw new Error("This creative asset has no uploaded file");
    const file = await prisma.fileObject.findUniqueOrThrow({ where: { id: asset.fileId } });
    const buffer = await readFile(file.storageKey);
    return reply.type(file.mimeType).header("Cache-Control", "private, max-age=300").send(buffer);
  });

  app.delete("/api/content/requests/:id", { preHandler: requirePermission("content.write") }, async (request) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const content = await prisma.contentRequest.findUniqueOrThrow({
      where: { id: params.id },
      include: { items: { include: { publishingRecords: true } }, assets: true, _count: { select: { knowledgeEvidenceBundles: true } } }
    });
    if (content._count.knowledgeEvidenceBundles) {
      throw Object.assign(new Error("Evidence-backed content requests remain auditable and cannot be permanently deleted"), { statusCode: 409 });
    }
    const itemIds = content.items.map((item) => item.id);
    const assetIds = content.assets.map((asset) => asset.id);
    const retainedGeneratedAssetIds = content.assets
      .filter((asset) => asset.assetType === "image" && asset.fileId === null && asset.sourceTool === "n8n")
      .map((asset) => asset.id);
    const deletedAssetIds = assetIds.filter((id) => !retainedGeneratedAssetIds.includes(id));
    await prisma.$transaction([
      prisma.approval.deleteMany({ where: { entityId: { in: [content.id, ...assetIds] } } }),
      prisma.creativeAsset.updateMany({ where: { id: { in: retainedGeneratedAssetIds } }, data: { contentRequestId: null, status: "library" } }),
      prisma.creativeAsset.deleteMany({ where: { id: { in: deletedAssetIds } } }),
      prisma.automationJob.deleteMany({ where: { OR: [
        { contentRequestId: content.id },
        { relatedEntityType: "content_request", relatedEntityId: content.id },
        { relatedEntityType: "content_item", relatedEntityId: { in: itemIds } }
      ] } }),
      prisma.contentRequest.delete({ where: { id: content.id } })
    ]);
    await audit({ actorUserId: current.user.id, action: "content.request_deleted", entityType: "content_request", entityId: content.id, summary: `Content request permanently deleted from ${content.status}` });
    return { ok: true };
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
    const content = await prisma.contentRequest.findUniqueOrThrow({ where: { id: params.id }, include: { items: true } });
    if (["approved_internal", "approved_publication", "revision_requested"].includes(input.decision) && content.items.length === 0) {
      throw new Error("Generate copy before reviewing this request");
    }
    const requiresCreative = input.decision === "approved_publication" && getCreativeWorkflowType(content.format) !== null;
    const nextStatus = requiresCreative ? "APPROVED_INTERNAL" : statusMap[input.decision];
    const updated = await prisma.contentRequest.update({ where: { id: params.id }, data: { status: nextStatus } });
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
    if (requiresCreative) {
      creativeJob = await requestCreativeProduction(updated.id, current.user.id);
    }
    await audit({ actorUserId: current.user.id, action: `content.${input.decision}`, entityType: "content_request", entityId: params.id, summary: `Content review: ${input.decision}` });
    return { request: updated, creativeJob };
  });

  app.post("/api/content/assets/:id/review", { preHandler: requirePermission("content.review") }, async (request) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = z.object({ decision: z.enum(["approved", "regenerate", "rejected"]), notes: z.string().optional() }).parse(request.body);
    const asset = await prisma.creativeAsset.findUniqueOrThrow({ where: { id: params.id } });
    if (!asset.contentRequestId) throw new Error("Creative asset is not linked to a content request");
    const metadata = asset.metadata as Record<string, unknown> | null;
    const automationJobId = typeof metadata?.automationJobId === "string" ? metadata.automationJobId : null;
    const imageSet = automationJobId
      ? await prisma.creativeAsset.findMany({
          where: { contentRequestId: asset.contentRequestId, metadata: { path: "$.automationJobId", equals: automationJobId } },
          select: { id: true, fileId: true }
        })
      : [{ id: asset.id, fileId: asset.fileId }];
    const imageSetIds = imageSet.map((entry) => entry.id);
    const imageSetFileIds = imageSet.flatMap((entry) => entry.fileId ? [entry.fileId] : []);

    if (input.decision === "approved") {
      await prisma.$transaction([
        prisma.creativeAsset.updateMany({ where: { contentRequestId: asset.contentRequestId, id: { notIn: imageSetIds } }, data: { approvalStatus: "rejected", status: "superseded" } }),
        prisma.creativeAsset.updateMany({ where: { id: { in: imageSetIds } }, data: { approvalStatus: "approved", status: "approved" } }),
        prisma.fileObject.updateMany({ where: { id: { in: imageSetFileIds } }, data: { approvalStatus: "approved" } }),
        prisma.contentRequest.update({ where: { id: asset.contentRequestId }, data: { status: "APPROVED_PUBLICATION" } }),
        prisma.approval.create({ data: { entityType: "creative_asset_set", entityId: asset.id, approvalType: "creative", status: "approved", decidedByUserId: current.user.id, decisionNotes: input.notes, decidedAt: new Date() } })
      ]);
    } else {
      await prisma.$transaction([
        prisma.creativeAsset.updateMany({ where: { id: { in: imageSetIds } }, data: { approvalStatus: input.decision, status: input.decision } }),
        prisma.fileObject.updateMany({ where: { id: { in: imageSetFileIds } }, data: { approvalStatus: input.decision } }),
        prisma.contentRequest.update({ where: { id: asset.contentRequestId }, data: { status: input.decision === "rejected" ? "REJECTED" : "APPROVED_INTERNAL" } })
      ]);
      if (input.decision === "regenerate") await requestCreativeProduction(asset.contentRequestId, current.user.id);
    }    await audit({ actorUserId: current.user.id, action: `creative.${input.decision}`, entityType: "creative_asset", entityId: asset.id, summary: `Creative review: ${input.decision}` });
    return { ok: true };
  });

  app.delete("/api/content/publishing-records/:id", { preHandler: requirePermission("publishing.request") }, async (request) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const record = await prisma.publishingRecord.findUniqueOrThrow({ where: { id: params.id } });
    await prisma.publishingRecord.delete({ where: { id: record.id } });
    await audit({
      actorUserId: current.user.id,
      action: "publishing.record_deleted",
      entityType: "publishing_record",
      entityId: record.id,
      summary: "Publishing record deleted from CP only; external platform post was not modified",
      metadata: { contentItemId: record.contentItemId, platform: record.platform, status: record.status, automationJobId: record.automationJobId }
    });
    return { ok: true };
  });

  app.delete("/api/content/items/:id/publishing-records", { preHandler: requirePermission("publishing.request") }, async (request) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const deleted = await prisma.publishingRecord.deleteMany({ where: { contentItemId: params.id } });
    await audit({
      actorUserId: current.user.id,
      action: "publishing.records_cleared",
      entityType: "content_item",
      entityId: params.id,
      summary: "All publishing records cleared from CP only; external platform posts were not modified",
      metadata: { count: deleted.count }
    });
    return { ok: true, deleted: deleted.count };
  });
  app.post("/api/content/items/:id/publish", { preHandler: requirePermission("publishing.request") }, async (request, reply) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = z.object({ platforms: z.array(z.enum(["facebook", "instagram"])).min(1), dryRun: z.boolean().default(true) }).parse(request.body);
    const unavailablePlatform = getUnavailablePublishingPlatform(input.platforms);
    if (unavailablePlatform) return reply.code(409).send(unavailablePlatform);
    const item = await prisma.contentItem.findUniqueOrThrow({ where: { id: params.id }, include: { request: { include: { assets: true } }, publishingRecords: true } });
    if (item.request.status !== "APPROVED_PUBLICATION") throw new Error("Content is not approved for publication");
    const approvedAssets = item.request.assets
      .filter((asset) => asset.approvalStatus === "approved")
      .sort((a, b) => {
        const aPosition = Number((a.metadata as Record<string, unknown> | null)?.imageSetPosition ?? 1);
        const bPosition = Number((b.metadata as Record<string, unknown> | null)?.imageSetPosition ?? 1);
        return aPosition - bPosition;
      });
    const approvedAsset = approvedAssets[0];
    if (getCreativeWorkflowType(item.request.format) && !approvedAssets.length) throw new Error("Approve the required media before publishing");
    if (item.request.format === "text" && input.platforms.includes("instagram")) throw new Error("Instagram publishing requires an approved image or video");
    if (!input.dryRun) {
      const checked = new Set(item.publishingRecords.filter((record) => record.mode === "DRY_RUN").map((record) => record.platform.toLowerCase()));
      const unchecked = input.platforms.filter((platform) => !checked.has(platform));
      if (unchecked.length) throw new Error(`Run the publishing check for ${unchecked.join(", ")} first`);
    }
    const mediaFileDescriptors = await Promise.all(approvedAssets.map(async (asset) => {
      if (!asset.fileId) return null;
      const file = await prisma.fileObject.findUnique({ where: { id: asset.fileId } });
      if (!file) return null;
      const metadata = asset.metadata && typeof asset.metadata === "object" && !Array.isArray(asset.metadata) ? asset.metadata as Record<string, unknown> : {};
      return {
        creative_asset_id: asset.id,
        file_id: file.id,
        name: file.originalName,
        mime_type: file.mimeType,
        size_bytes: file.sizeBytes,
        position: Number(metadata.imageSetPosition ?? 1)
      };
    }));
    const publishMediaFileDescriptors = mediaFileDescriptors.filter((file): file is NonNullable<typeof file> => file !== null);
    if (getCreativeWorkflowType(item.request.format) && !publishMediaFileDescriptors.length) throw new Error("Approved media file is unavailable for publishing");

    const records = [];
    for (const platform of input.platforms) {
      const idempotencyKey = `publish:${platform}:${item.id}:${input.dryRun ? "dry" : "live"}`;
      const basePayload = {
        platform,
        dryRun: input.dryRun,
        caption: item.caption,
        headline: item.headline,
        cta: item.cta,
        hashtags: item.hashtags,
        destination_key: "FUTURE_OILS",
        creative_asset_id: approvedAsset?.id ?? null,
        creative_asset: approvedAsset?.metadata ?? null,
        creative_asset_ids: approvedAssets.map((asset) => asset.id),
        creative_assets: approvedAssets.map((asset) => ({ id: asset.id, file_id: asset.fileId, metadata: asset.metadata }))
      };
      const job = await createAutomationJob({
        jobType: `publish_${platform}`,
        title: `${input.dryRun ? "Dry-run" : "Publish"} ${platform}`,
        workflowName: config.N8N_PUBLISH_WEBHOOK_PATH,
        relatedEntityType: "content_item",
        relatedEntityId: item.id,
        requestedByUserId: current.user.id,
        idempotencyKey,
        inputPayload: { ...basePayload, media_files: publishMediaFileDescriptors }
      });
      const mediaFilesWithUrls = publishMediaFileDescriptors.map((file) => {
        const expires = Date.now() + 10 * 60 * 1000;
        const nonce = `${job.id}_${file.creative_asset_id}_${Math.random().toString(36).slice(2)}`;
        const signature = signPayload(config.PLATFORM_CALLBACK_SECRET, String(expires), nonce, `${job.id}.${file.creative_asset_id}`);
        const params = new URLSearchParams({ job_id: job.id, expires: String(expires), nonce, signature });
        return {
          ...file,
          download_url: `${config.APP_BASE_URL.replace(/\/$/, "")}/api/automation/publishing-assets/${file.creative_asset_id}/file?${params.toString()}`
        };
      });
      await prisma.automationJob.update({
        where: { id: job.id },
        data: { inputPayload: { ...basePayload, media_files: mediaFilesWithUrls } }
      });
      let dispatchError: string | null = null;
      try {
        await dispatchJob(job.id);
      } catch (error) {
        dispatchError = error instanceof Error ? error.message : "Publishing workflow dispatch failed";
      }
      const recordStatus = dispatchError ? "FAILED" : input.dryRun ? "DRY_RUN" : "QUEUED";
      const record = await prisma.publishingRecord.upsert({
        where: { idempotencyKey },
        update: {
          status: recordStatus,
          automationJobId: job.id,
          errors: dispatchError ? { message: dispatchError } : undefined
        },
        create: {
          contentItemId: item.id,
          platform: platform.toUpperCase() as any,
          status: recordStatus,
          mode: input.dryRun ? "DRY_RUN" : "LIVE",
          idempotencyKey,
          automationJobId: job.id,
          requestedByUserId: current.user.id,
          errors: dispatchError ? { message: dispatchError } : undefined
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
  const productAssetIds = resolveProductAssetIds([
    content.product,
    content.topic,
  ].filter(Boolean).join(" "));
  const job = await createAutomationJob({
    jobType: creativeType,
    title: `${creativeType === "creative_video_generation" ? "Generate video" : "Generate image"}: ${content.topic.slice(0, 80)}`,
    workflowName,
    relatedEntityType: "content_request",
    relatedEntityId: content.id,
    contentRequestId: content.id,
    requestedByUserId,
    idempotencyKey: `creative:${creativeType}:${content.id}:${Date.now()}`,
    inputPayload: {
      content_request_id: content.id,
      content_item_id: latestItem?.id ?? null,
      format: content.format,
      brand: content.brand,
      business_line: content.businessLine,
      product: content.product,
      topic: content.topic,
      brand_id: resolveBrandId(content.brand),
      logo_id: "primary",
      template_background_id: content.creativeTemplateId || "future-oils-classic",
      product_asset_id: productAssetIds[0] ?? null,
      product_asset_ids: productAssetIds,
      ratio: "4:5",
      visual_direction: "premium clean B2B commercial background with bright neutral lighting",
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
  const refreshed = await prisma.automationJob.findUnique({ where: { id: job.id } });
  if (refreshed?.currentStatus === "COMPLETED") {
    const output = refreshed.outputPayload as Record<string, unknown> | null;
    const files = Array.isArray(output?.files) ? output.files as Record<string, unknown>[] : [];
    const existing = await prisma.creativeAsset.findFirst({ where: { contentRequestId: content.id, metadata: { path: "$.automationJobId", equals: job.id } } });
    if (!existing) await prisma.creativeAsset.create({ data: {
      contentRequestId: content.id,
      assetType: creativeType === "creative_video_generation" ? "video" : "image",
      status: "ready_for_review",
      approvalStatus: "not_approved",
      sourceTool: "n8n",
      metadata: { automationJobId: job.id, file: files[0] ?? null, output } as any
    } });
  }
  return refreshed;
}

function getCreativeWorkflowType(format: string) {
  if (format === "text_video") return "creative_video_generation";
  if (format === "text_image" || format === "carousel") return "creative_image_generation";
  return null;
}

function resolveBrandId(brand: string) {
  return /future oils/i.test(brand) ? "future-oils" : "future-oils";
}

function resolveProductAssetIds(product?: string | null) {
  if (!product) return [];
  const source = product.toLowerCase();
  const compact = source.replace(/\s+/g, "");
  const isSunflowerOilRequest = /sunflower|oil/i.test(source);
  if (!isSunflowerOilRequest) return [];

  const ids: string[] = [];
  for (const size of ["18l", "17l", "10l", "5l", "4l", "3l", "1l"]) {
    const liters = size.slice(0, -1);
    const standaloneCapacity = new RegExp(`(^|[^0-9])${liters}([^0-9]|$)`, "i");
    if (compact.includes(size) || standaloneCapacity.test(source)) {
      ids.push(`sunflower-oil-${size}`);
    }
  }
  return [...new Set(ids)];
}

function resolveProductAssetId(product?: string | null) {
  return resolveProductAssetIds(product)[0] ?? null;
}
