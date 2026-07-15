import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { z } from "zod";
import { prisma } from "../db.js";
import { requirePermission } from "../security/auth.js";
import { verifyKnowledgeFile } from "../services/fileVerification.js";
import { deleteFile, readFile, saveFile } from "../services/storage.js";

const metadataSchema = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.string().trim().min(1).max(120),
  sourceType: z.string().trim().min(1).max(120),
  locale: z.string().trim().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).default("en"),
  market: z.string().trim().max(120).optional().default(""),
  versionLabel: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(5000).optional().default("")
});

const updateMetadataSchema = metadataSchema.omit({ versionLabel: true }).partial().refine(
  (input) => Object.keys(input).length > 0,
  "Provide at least one metadata field"
);

const listQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(120).optional(),
  locale: z.string().trim().max(40).optional(),
  market: z.string().trim().max(120).optional(),
  lifecycle: z.enum(["ACTIVE", "ARCHIVED", "ALL"]).default("ACTIVE"),
  fileType: z.enum(["pdf", "txt", "csv", "png", "jpg", "jpeg", "webp"]).optional(),
  uploadedFrom: z.coerce.date().optional(),
  uploadedTo: z.coerce.date().optional()
});

type ParsedUpload = {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  fields: Record<string, string>;
};

const documentInclude = {
  createdBy: { select: { id: true, displayName: true, username: true } },
  versions: {
    include: {
      fileObject: true,
      uploadedBy: { select: { id: true, displayName: true, username: true } },
      reviewedBy: { select: { id: true, displayName: true, username: true } },
      approvedBy: { select: { id: true, displayName: true, username: true } },
      reviewEvents: {
        include: { actor: { select: { id: true, displayName: true, username: true } } },
        orderBy: { createdAt: "desc" as const }
      },
      _count: { select: { claimSources: true } }
    },
    orderBy: { versionNumber: "desc" as const }
  }
};

export async function knowledgeRoutes(app: FastifyInstance) {
  app.get("/api/knowledge/documents", { preHandler: requirePermission("knowledge.read") }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const where: Prisma.KnowledgeDocumentWhereInput = {
      ...(query.lifecycle === "ALL" ? {} : { lifecycleStatus: query.lifecycle }),
      ...(query.category ? { category: query.category } : {}),
      ...(query.locale ? { locale: query.locale } : {}),
      ...(query.market ? { market: query.market } : {}),
      ...(query.search ? {
        OR: [
          { title: { contains: query.search } },
          { category: { contains: query.search } },
          { sourceType: { contains: query.search } },
          { market: { contains: query.search } }
        ]
      } : {}),
      ...((query.fileType || query.uploadedFrom || query.uploadedTo) ? {
        versions: {
          some: {
            ...(query.fileType ? { fileObject: { fileExtension: query.fileType } } : {}),
            ...((query.uploadedFrom || query.uploadedTo) ? {
              createdAt: {
                ...(query.uploadedFrom ? { gte: query.uploadedFrom } : {}),
                ...(query.uploadedTo ? { lte: query.uploadedTo } : {})
              }
            } : {})
          }
        }
      } : {})
    };
    const documents = await prisma.knowledgeDocument.findMany({
      where,
      include: documentInclude,
      orderBy: { updatedAt: "desc" },
      take: 250
    });
    return { documents: documents.map(serializeDocument) };
  });

  app.post("/api/knowledge/documents", { preHandler: requirePermission("knowledge.upload") }, async (request, reply) => {
    const current = request.currentUser!;
    const upload = await parseUpload(request);
    const metadata = metadataSchema.parse(upload.fields);
    const verified = verifyKnowledgeFile(upload.buffer, upload.filename, upload.mimetype);
    const documentId = nanoid(24);
    const versionId = nanoid(24);
    const fileId = nanoid(24);
    const stored = await saveFile(upload.buffer, verified.originalName, verified.detectedMimeType, {
      namespace: "knowledge-base",
      documentId,
      versionId,
      extension: verified.extension
    });
    try {
      const duplicateCount = await prisma.fileObject.count({ where: { sha256Hash: stored.sha256Hash } });
      const document = await prisma.$transaction(async (tx) => {
        await tx.fileObject.create({ data: {
          id: fileId,
          storageKey: stored.storageKey,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          declaredMimeType: verified.declaredMimeType,
          fileExtension: verified.extension,
          sizeBytes: stored.sizeBytes,
          sha256Hash: stored.sha256Hash,
          assetType: "knowledge_document",
          visibilityScope: "RESTRICTED",
          approvalStatus: "not_applicable",
          securityStatus: verified.securityStatus,
          createdByUserId: current.user.id
        } });
        await tx.knowledgeDocument.create({ data: {
          id: documentId,
          title: metadata.title,
          category: metadata.category,
          sourceType: metadata.sourceType,
          locale: metadata.locale,
          market: metadata.market || null,
          notes: metadata.notes || null,
          createdByUserId: current.user.id,
          versions: { create: {
            id: versionId,
            fileObjectId: fileId,
            versionNumber: 1,
            versionLabel: metadata.versionLabel || null,
            uploadedByUserId: current.user.id
          } }
        } });
        await tx.auditEvent.createMany({ data: [
          {
            actorUserId: current.user.id,
            action: "knowledge.document_created",
            entityType: "knowledge_document",
            entityId: documentId,
            summary: "Knowledge Library document created",
            metadata: { category: metadata.category, locale: metadata.locale }
          },
          {
            actorUserId: current.user.id,
            action: "knowledge.file_uploaded",
            entityType: "knowledge_document",
            entityId: documentId,
            summary: "Initial private document version uploaded",
            metadata: { versionId, versionNumber: 1, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes, securityStatus: verified.securityStatus }
          }
        ] });
        return tx.knowledgeDocument.findUniqueOrThrow({ where: { id: documentId }, include: documentInclude });
      });
      return reply.code(201).send({
        document: serializeDocument(document),
        warnings: duplicateCount ? [{ code: "DUPLICATE_CHECKSUM", message: "An identical file already exists in private storage." }] : []
      });
    } catch (error) {
      await deleteFile(stored.storageKey).catch(() => undefined);
      throw error;
    }
  });

  app.get("/api/knowledge/documents/:id", { preHandler: requirePermission("knowledge.read") }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const [document, auditEvents] = await Promise.all([
      prisma.knowledgeDocument.findUniqueOrThrow({ where: { id: params.id }, include: documentInclude }),
      prisma.auditEvent.findMany({
        where: { entityType: "knowledge_document", entityId: params.id },
        include: { actor: { select: { displayName: true, username: true } } },
        orderBy: { createdAt: "desc" },
        take: 50
      })
    ]);
    return {
      document: serializeDocument(document),
      auditEvents: auditEvents.map((event) => ({
        id: event.id,
        action: event.action,
        summary: event.summary,
        metadata: event.metadata,
        createdAt: event.createdAt,
        actor: event.actor
      }))
    };
  });

  app.patch("/api/knowledge/documents/:id", { preHandler: requirePermission("knowledge.edit") }, async (request) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = updateMetadataSchema.parse(request.body);
    const document = await prisma.$transaction(async (tx) => {
      await tx.knowledgeDocument.update({
        where: { id: params.id },
        data: {
          title: input.title,
          category: input.category,
          sourceType: input.sourceType,
          locale: input.locale,
          market: input.market === undefined ? undefined : input.market || null,
          notes: input.notes === undefined ? undefined : input.notes || null
        }
      });
      await tx.auditEvent.create({ data: {
        actorUserId: current.user.id,
        action: "knowledge.metadata_edited",
        entityType: "knowledge_document",
        entityId: params.id,
        summary: "Knowledge Library metadata updated",
        metadata: { fields: Object.keys(input) }
      } });
      return tx.knowledgeDocument.findUniqueOrThrow({ where: { id: params.id }, include: documentInclude });
    });
    return { document: serializeDocument(document) };
  });

  app.post("/api/knowledge/documents/:id/versions", { preHandler: requirePermission("knowledge.upload") }, async (request, reply) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const upload = await parseUpload(request);
    const versionLabel = z.string().trim().max(120).optional().default("").parse(upload.fields.versionLabel);
    const verified = verifyKnowledgeFile(upload.buffer, upload.filename, upload.mimetype);
    const versionId = nanoid(24);
    const fileId = nanoid(24);
    const stored = await saveFile(upload.buffer, verified.originalName, verified.detectedMimeType, {
      namespace: "knowledge-base",
      documentId: params.id,
      versionId,
      extension: verified.extension
    });
    try {
      const duplicateCount = await prisma.fileObject.count({ where: { sha256Hash: stored.sha256Hash } });
      const document = await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM KnowledgeDocument WHERE id = ${params.id} FOR UPDATE`;
        if (!locked.length) throw new Error("Knowledge document not found");
        const previous = await tx.knowledgeDocumentVersion.findFirst({
          where: { documentId: params.id },
          orderBy: { versionNumber: "desc" }
        });
        const versionNumber = (previous?.versionNumber ?? 0) + 1;
        await tx.fileObject.create({ data: {
          id: fileId,
          storageKey: stored.storageKey,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          declaredMimeType: verified.declaredMimeType,
          fileExtension: verified.extension,
          sizeBytes: stored.sizeBytes,
          sha256Hash: stored.sha256Hash,
          assetType: "knowledge_document",
          visibilityScope: "RESTRICTED",
          approvalStatus: "not_applicable",
          securityStatus: verified.securityStatus,
          createdByUserId: current.user.id
        } });
        await tx.knowledgeDocumentVersion.create({ data: {
          id: versionId,
          documentId: params.id,
          fileObjectId: fileId,
          versionNumber,
          versionLabel: versionLabel || null,
          uploadedByUserId: current.user.id,
          supersedesVersionId: previous?.id
        } });
        if (previous) {
          await tx.knowledgeDocumentVersion.update({
            where: { id: previous.id },
            data: {
              supersededAt: new Date(),
              reviewStatus: previous.reviewStatus === "APPROVED_SOURCE" ? "APPROVED_SOURCE" : "SUPERSEDED"
            }
          });
        }
        await tx.knowledgeDocument.update({ where: { id: params.id }, data: { updatedAt: new Date() } });
        await tx.auditEvent.createMany({ data: [
          {
            actorUserId: current.user.id,
            action: "knowledge.file_uploaded",
            entityType: "knowledge_document",
            entityId: params.id,
            summary: "Private document replacement file uploaded",
            metadata: { versionId, versionNumber, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes, securityStatus: verified.securityStatus }
          },
          {
            actorUserId: current.user.id,
            action: "knowledge.version_uploaded",
            entityType: "knowledge_document",
            entityId: params.id,
            summary: `Knowledge Library version ${versionNumber} created`,
            metadata: { versionId, versionNumber, supersedesVersionId: previous?.id ?? null }
          }
        ] });
        return tx.knowledgeDocument.findUniqueOrThrow({ where: { id: params.id }, include: documentInclude });
      });
      return reply.code(201).send({
        document: serializeDocument(document),
        warnings: duplicateCount ? [{ code: "DUPLICATE_CHECKSUM", message: "An identical file already exists in private storage." }] : []
      });
    } catch (error) {
      await deleteFile(stored.storageKey).catch(() => undefined);
      throw error;
    }
  });

  app.get("/api/knowledge/documents/:id/versions/:versionId/file", { preHandler: requirePermission("knowledge.read") }, async (request, reply) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string(), versionId: z.string() }).parse(request.params);
    const { disposition } = z.object({ disposition: z.enum(["attachment", "inline"]).default("attachment") }).parse(request.query);
    const version = await prisma.knowledgeDocumentVersion.findFirstOrThrow({
      where: { id: params.versionId, documentId: params.id },
      include: { document: { select: { lifecycleStatus: true } }, fileObject: true }
    });
    if (version.fileObject.assetType !== "knowledge_document") throw new Error("File is not a Knowledge Library document");
    const buffer = await readFile(version.fileObject.storageKey);
    await prisma.auditEvent.create({ data: {
      actorUserId: current.user.id,
      action: disposition === "inline" ? "knowledge.file_viewed" : "knowledge.file_downloaded",
      entityType: "knowledge_document",
      entityId: params.id,
      summary: disposition === "inline" ? "Private Knowledge Library file viewed" : "Private Knowledge Library file downloaded",
      metadata: { versionId: version.id, versionNumber: version.versionNumber, lifecycleStatus: version.document.lifecycleStatus }
    } });
    const downloadName = version.fileObject.originalName.replace(/["\r\n]/g, "_");
    return reply
      .type(version.fileObject.mimeType)
      .header("Cache-Control", "private, no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Disposition", `${disposition}; filename="${downloadName}"`)
      .send(buffer);
  });

  app.post("/api/knowledge/documents/:id/versions/:versionId/submit-review", { preHandler: requirePermission("knowledge.edit") }, async (request) => {
    return transitionSourceReview(request, "READY_FOR_REVIEW", ["UPLOADED"], "knowledge.source_review_submitted", "Source version submitted for review");
  });

  app.post("/api/knowledge/documents/:id/versions/:versionId/begin-review", { preHandler: requirePermission("knowledge.review") }, async (request) => {
    return transitionSourceReview(request, "UNDER_REVIEW", ["READY_FOR_REVIEW"], "knowledge.source_review_started", "Source version review started");
  });

  app.post("/api/knowledge/documents/:id/versions/:versionId/approve-source", { preHandler: requirePermission("knowledge.approve") }, async (request) => {
    return transitionSourceReview(request, "APPROVED_SOURCE", ["UNDER_REVIEW"], "knowledge.source_approved", "Document version approved as a trusted source");
  });

  app.post("/api/knowledge/documents/:id/versions/:versionId/reject", { preHandler: requirePermission("knowledge.review") }, async (request) => {
    return transitionSourceReview(request, "REJECTED", ["UNDER_REVIEW"], "knowledge.source_rejected", "Source version rejected", true);
  });

  app.post("/api/knowledge/documents/:id/versions/:versionId/return-uploaded", { preHandler: requirePermission("knowledge.review") }, async (request) => {
    return transitionSourceReview(request, "UPLOADED", ["READY_FOR_REVIEW", "UNDER_REVIEW", "REJECTED"], "knowledge.source_returned", "Source version returned to uploaded state");
  });

  app.post("/api/knowledge/documents/:id/archive", { preHandler: requirePermission("knowledge.archive") }, async (request) => {
    return setLifecycle(request, "ARCHIVED");
  });

  app.post("/api/knowledge/documents/:id/restore", { preHandler: requirePermission("knowledge.archive") }, async (request) => {
    return setLifecycle(request, "ACTIVE");
  });
}

async function setLifecycle(request: FastifyRequest, lifecycleStatus: "ACTIVE" | "ARCHIVED") {
  const current = request.currentUser!;
  const params = z.object({ id: z.string() }).parse(request.params);
  const existing = await prisma.knowledgeDocument.findUniqueOrThrow({ where: { id: params.id } });
  if (existing.lifecycleStatus === lifecycleStatus) {
    const document = await prisma.knowledgeDocument.findUniqueOrThrow({ where: { id: params.id }, include: documentInclude });
    return { document: serializeDocument(document) };
  }
  const document = await prisma.$transaction(async (tx) => {
    await tx.knowledgeDocument.update({ where: { id: params.id }, data: { lifecycleStatus } });
    await tx.auditEvent.create({ data: {
      actorUserId: current.user.id,
      action: lifecycleStatus === "ARCHIVED" ? "knowledge.document_archived" : "knowledge.document_restored",
      entityType: "knowledge_document",
      entityId: params.id,
      summary: lifecycleStatus === "ARCHIVED" ? "Knowledge Library document archived" : "Knowledge Library document restored"
    } });
    return tx.knowledgeDocument.findUniqueOrThrow({ where: { id: params.id }, include: documentInclude });
  });
  return { document: serializeDocument(document) };
}

async function transitionSourceReview(
  request: FastifyRequest,
  newStatus: "UPLOADED" | "READY_FOR_REVIEW" | "UNDER_REVIEW" | "APPROVED_SOURCE" | "REJECTED",
  allowedFrom: string[],
  auditAction: string,
  summary: string,
  requireReason = false
) {
  const current = request.currentUser!;
  const params = z.object({ id: z.string(), versionId: z.string() }).parse(request.params);
  const input = z.object({
    notes: z.string().trim().max(5000).optional().default(""),
    rejectionReason: requireReason ? z.string().trim().min(2).max(5000) : z.string().trim().max(5000).optional().default("")
  }).parse(request.body ?? {});
  if (requireReason && input.rejectionReason.trim().length < 2) {
    throw Object.assign(new Error("A rejection reason is required"), { statusCode: 400 });
  }
  const existing = await prisma.knowledgeDocumentVersion.findFirstOrThrow({
    where: { id: params.versionId, documentId: params.id },
    include: { document: true, fileObject: true }
  });
  if (existing.document.lifecycleStatus !== "ACTIVE") throw httpConflict("Archived documents must be restored before review");
  if (existing.fileObject.securityStatus === "REJECTED") throw httpConflict("A rejected file cannot enter source review");
  if (!allowedFrom.includes(existing.reviewStatus)) throw httpConflict("Invalid source review transition");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.knowledgeDocumentVersion.update({
      where: { id: existing.id },
      data: {
        reviewStatus: newStatus,
        reviewedByUserId: newStatus === "UNDER_REVIEW" || newStatus === "REJECTED" ? current.user.id : undefined,
        reviewedAt: newStatus === "UNDER_REVIEW" || newStatus === "REJECTED" ? now : undefined,
        approvedByUserId: newStatus === "APPROVED_SOURCE" ? current.user.id : undefined,
        approvedAt: newStatus === "APPROVED_SOURCE" ? now : undefined,
        rejectionReason: newStatus === "REJECTED" ? input.rejectionReason : null,
        reviewNotes: input.notes || null
      }
    });
    await tx.knowledgeDocumentVersionReview.create({ data: {
      versionId: existing.id,
      actorUserId: current.user.id,
      action: auditAction,
      previousStatus: existing.reviewStatus,
      newStatus,
      notes: input.notes || null,
      rejectionReason: newStatus === "REJECTED" ? input.rejectionReason : null
    } });
    await tx.auditEvent.create({ data: {
      actorUserId: current.user.id,
      action: auditAction,
      entityType: "knowledge_document",
      entityId: params.id,
      summary,
      metadata: { versionId: existing.id, versionNumber: existing.versionNumber, from: existing.reviewStatus, to: newStatus }
    } });
  });
  const document = await prisma.knowledgeDocument.findUniqueOrThrow({ where: { id: params.id }, include: documentInclude });
  return { document: serializeDocument(document) };
}

function httpConflict(message: string) {
  return Object.assign(new Error(message), { statusCode: 409 });
}

async function parseUpload(request: FastifyRequest): Promise<ParsedUpload> {
  const fields: Record<string, string> = {};
  let file: Omit<ParsedUpload, "fields"> | undefined;
  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (file) throw new Error("Upload exactly one file");
      file = {
        buffer: await part.toBuffer(),
        filename: part.filename,
        mimetype: part.mimetype
      };
    } else {
      fields[part.fieldname] = String(part.value ?? "");
    }
  }
  if (!file) throw new Error("Choose a document to upload");
  return { ...file, fields };
}

function serializeDocument(document: any) {
  const versions = document.versions.map(serializeVersion);
  return {
    id: document.id,
    title: document.title,
    category: document.category,
    sourceType: document.sourceType,
    locale: document.locale,
    market: document.market,
    notes: document.notes,
    lifecycleStatus: document.lifecycleStatus,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    createdBy: document.createdBy,
    currentVersion: versions[0] ?? null,
    versions
  };
}

function serializeVersion(version: any) {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    versionLabel: version.versionLabel,
    reviewStatus: version.reviewStatus,
    reviewedBy: version.reviewedBy,
    reviewedAt: version.reviewedAt,
    approvedBy: version.approvedBy,
    approvedAt: version.approvedAt,
    rejectionReason: version.rejectionReason,
    reviewNotes: version.reviewNotes,
    supersededAt: version.supersededAt,
    linkedClaimCount: version._count?.claimSources ?? 0,
    reviewHistory: version.reviewEvents ?? [],
    supersedesVersionId: version.supersedesVersionId,
    createdAt: version.createdAt,
    uploadedBy: version.uploadedBy,
    file: {
      originalName: version.fileObject.originalName,
      mimeType: version.fileObject.mimeType,
      fileExtension: version.fileObject.fileExtension,
      sizeBytes: version.fileObject.sizeBytes,
      checksumSummary: version.fileObject.sha256Hash.slice(0, 12),
      securityStatus: version.fileObject.securityStatus,
      downloadUrl: `/api/knowledge/documents/${version.documentId}/versions/${version.id}/file`
    }
  };
}
