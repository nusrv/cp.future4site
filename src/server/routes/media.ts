import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { requirePermission } from "../security/auth.js";
import { audit } from "../services/audit.js";
import { deleteFile, readFile, saveFile } from "../services/storage.js";

const imageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const inactiveAssetStatuses = ["superseded", "rejected", "regenerate"];

type AssetUsage = {
  id: string;
  fileId: string | null;
  approvalStatus: string;
  createdAt: Date;
  metadata: Prisma.JsonValue | null;
  request: { id: string; topic: string; status: string } | null;
};

export async function mediaRoutes(app: FastifyInstance) {
  app.get("/api/media/images", { preHandler: requirePermission("content.read") }, async () => {
    const [files, generatedAssets] = await Promise.all([
      prisma.fileObject.findMany({ where: { assetType: "image" }, orderBy: { createdAt: "desc" }, take: 250 }),
      prisma.creativeAsset.findMany({
        where: { assetType: "image", fileId: null, status: { notIn: inactiveAssetStatuses } },
        orderBy: { createdAt: "desc" },
        take: 250,
        select: { id: true, fileId: true, approvalStatus: true, createdAt: true, metadata: true, request: { select: { id: true, topic: true, status: true } } }
      })
    ]);
    const fileIds = files.map((file) => file.id);
    const storedUsages: AssetUsage[] = fileIds.length ? await prisma.creativeAsset.findMany({
      where: { fileId: { in: fileIds }, status: { notIn: inactiveAssetStatuses } },
      select: { id: true, fileId: true, approvalStatus: true, createdAt: true, metadata: true, request: { select: { id: true, topic: true, status: true } } }
    }) : [];

    const storedImages = files.map((file) => {
      const usages = storedUsages.filter((usage) => usage.fileId === file.id);
      return {
        id: file.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        width: file.width,
        height: file.height,
        approvalStatus: file.approvalStatus,
        createdAt: file.createdAt,
        previewUrl: `/api/media/images/${file.id}/file`,
        storageType: "stored" as const,
        selection: { fileId: file.id },
        usageCount: usages.length,
        canDelete: usages.length === 0,
        uses: formatUsages(usages)
      };
    });

    const generatedByUrl = new Map<string, AssetUsage[]>();
    for (const asset of generatedAssets) {
      const url = findImageUrl(asset.metadata);
      if (!url) continue;
      const group = generatedByUrl.get(url) ?? [];
      group.push(asset);
      generatedByUrl.set(url, group);
    }
    const generatedImages = [...generatedByUrl.entries()].map(([url, usages]) => {
      const source = usages[0];
      const topic = source.request?.topic ?? "Generated content image";
      return {
        id: `asset:${source.id}`,
        originalName: `Generated image for ${topic}`,
        mimeType: "image/external",
        sizeBytes: 0,
        width: null,
        height: null,
        approvalStatus: source.approvalStatus,
        createdAt: source.createdAt,
        previewUrl: url,
        storageType: "generated" as const,
        selection: { assetId: source.id },
        usageCount: usages.length,
        canDelete: false,
        uses: formatUsages(usages)
      };
    });

    return { images: [...storedImages, ...generatedImages].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) };
  });

  app.post("/api/media/images", { preHandler: requirePermission("content.write") }, async (request) => {
    const current = request.currentUser!;
    const part = await request.file();
    if (!part) throw new Error("Choose an image to upload");
    if (!imageMimeTypes.has(part.mimetype)) throw new Error("Upload a PNG, JPEG, or WebP image");
    const stored = await saveFile(await part.toBuffer(), part.filename, part.mimetype);
    let file;
    try {
      file = await prisma.fileObject.create({ data: {
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
    } catch (error) {
      await deleteFile(stored.storageKey).catch(() => undefined);
      throw error;
    }
    await audit({ actorUserId: current.user.id, action: "media.image_uploaded", entityType: "file_object", entityId: file.id, summary: "Image added to media library" });
    return { image: { ...file, previewUrl: `/api/media/images/${file.id}/file`, storageType: "stored", selection: { fileId: file.id }, usageCount: 0, canDelete: true, uses: [] } };
  });

  app.get("/api/media/images/:id/file", { preHandler: requirePermission("content.read") }, async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const file = await prisma.fileObject.findUniqueOrThrow({ where: { id: params.id } });
    if (file.assetType !== "image") throw new Error("Requested file is not an image");
    const buffer = await readFile(file.storageKey);
    return reply.type(file.mimeType).header("Cache-Control", "private, max-age=300").send(buffer);
  });

  app.delete("/api/media/images/:id", { preHandler: requirePermission("content.write") }, async (request) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const file = await prisma.fileObject.findUniqueOrThrow({ where: { id: params.id } });
    if (file.assetType !== "image") throw new Error("Requested file is not an image");
    const activeUsageCount = await prisma.creativeAsset.count({ where: { fileId: file.id, status: { notIn: inactiveAssetStatuses } } });
    if (activeUsageCount) throw new Error("This image is attached to content. Replace or delete those uses before deleting it from the library");
    await prisma.$transaction([
      prisma.creativeAsset.deleteMany({ where: { fileId: file.id } }),
      prisma.fileObject.delete({ where: { id: file.id } })
    ]);
    let storageDeleted = true;
    try {
      await deleteFile(file.storageKey);
    } catch (error) {
      storageDeleted = false;
      await audit({ actorUserId: current.user.id, action: "media.image_storage_delete_failed", entityType: "file_object", entityId: file.id, summary: "Media library record deleted but stored file cleanup failed", metadata: { message: error instanceof Error ? error.message : "Unknown storage error" } });
    }
    await audit({ actorUserId: current.user.id, action: "media.image_deleted", entityType: "file_object", entityId: file.id, summary: "Unused image deleted from media library", metadata: { storageDeleted } });
    return { ok: true, storageDeleted };
  });

  app.post("/api/content/requests/:id/assets/select", { preHandler: requirePermission("content.write") }, async (request) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = z.object({ fileId: z.string().optional(), assetId: z.string().optional() }).refine((value) => Number(Boolean(value.fileId)) + Number(Boolean(value.assetId)) === 1, "Select exactly one library image").parse(request.body);
    const content = await prisma.contentRequest.findUniqueOrThrow({ where: { id: params.id } });
    if (!["text_image", "carousel"].includes(content.format)) throw new Error("Media library images can be selected only for image and carousel requests");
    if (["APPROVED_PUBLICATION", "ARCHIVED"].includes(content.status)) throw new Error("This request no longer accepts replacement images");

    const file = input.fileId ? await prisma.fileObject.findUniqueOrThrow({ where: { id: input.fileId } }) : null;
    const sourceAsset = input.assetId ? await prisma.creativeAsset.findUniqueOrThrow({ where: { id: input.assetId } }) : null;
    if (file && (file.assetType !== "image" || !imageMimeTypes.has(file.mimeType))) throw new Error("Select a supported image from the media library");
    if (sourceAsset && (sourceAsset.assetType !== "image" || !findImageUrl(sourceAsset.metadata))) throw new Error("Selected generated asset has no reusable image URL");

    const existing = file
      ? await prisma.creativeAsset.findFirst({ where: { contentRequestId: content.id, fileId: file.id } })
      : await prisma.creativeAsset.findFirst({ where: { contentRequestId: content.id, metadata: { path: "$.librarySourceAssetId", equals: sourceAsset!.id } } });
    const sourceMetadata = sourceAsset?.metadata && typeof sourceAsset.metadata === "object" && !Array.isArray(sourceAsset.metadata) ? sourceAsset.metadata : {};
    const assetData = file ? {
      fileId: file.id,
      metadata: { originalName: file.originalName, mimeType: file.mimeType, sizeBytes: file.sizeBytes, source: "media_library" } as Prisma.InputJsonValue
    } : {
      fileId: null,
      metadata: { ...sourceMetadata, librarySourceAssetId: sourceAsset!.id, source: "media_library" } as Prisma.InputJsonValue
    };
    const assetOperation = existing
      ? prisma.creativeAsset.update({ where: { id: existing.id }, data: { ...assetData, status: "ready_for_review", approvalStatus: "not_approved", sourceTool: "media_library" } })
      : prisma.creativeAsset.create({ data: {
          contentRequestId: content.id,
          ...assetData,
          assetType: "image",
          status: "ready_for_review",
          approvalStatus: "not_approved",
          sourceTool: "media_library",
          visibilityScope: "INTERNAL"
        } });
    const [, asset] = await prisma.$transaction([
      prisma.creativeAsset.updateMany({ where: { contentRequestId: content.id, ...(existing ? { id: { not: existing.id } } : {}) }, data: { status: "superseded", approvalStatus: "rejected" } }),
      assetOperation,
      prisma.contentRequest.update({ where: { id: content.id }, data: { status: "APPROVED_INTERNAL" } })
    ]);
    await audit({ actorUserId: current.user.id, action: "creative.library_image_selected", entityType: "creative_asset", entityId: asset.id, summary: "Media library image selected for content request", metadata: { fileId: file?.id ?? null, sourceAssetId: sourceAsset?.id ?? null, contentRequestId: content.id } });
    return { asset };
  });
}

function formatUsages(usages: AssetUsage[]) {
  return usages.flatMap((usage) => usage.request ? [{
    assetId: usage.id,
    requestId: usage.request.id,
    topic: usage.request.topic,
    requestStatus: usage.request.status,
    approvalStatus: usage.approvalStatus
  }] : []);
}

function findImageUrl(value: unknown, seen = new Set<object>()): string | undefined {
  if (!value || typeof value !== "object" || seen.has(value as object)) return undefined;
  seen.add(value as object);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageUrl(item, seen);
      if (found) return found;
    }
    return undefined;
  }
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && /^https?:\/\//.test(item) && /url|image|download|web/i.test(key)) return item;
  }
  for (const item of Object.values(value)) {
    const found = findImageUrl(item, seen);
    if (found) return found;
  }
  return undefined;
}
