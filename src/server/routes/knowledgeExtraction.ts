import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { requirePermission } from "../security/auth.js";
import { extractKnowledgeText, KnowledgeExtractionError } from "../services/knowledgeExtraction.js";
import { readFile } from "../services/storage.js";

const actorSelect = { id: true, displayName: true, username: true };

export async function knowledgeExtractionRoutes(app: FastifyInstance) {
  app.get("/api/knowledge/documents/:id/versions/:versionId/extractions", { preHandler: requirePermission("knowledge.read") }, async (request) => {
    const params = z.object({ id: z.string(), versionId: z.string() }).parse(request.params);
    const version = await prisma.knowledgeDocumentVersion.findFirstOrThrow({
      where: { id: params.versionId, documentId: params.id },
      select: { id: true }
    });
    const extractions = await prisma.knowledgeDocumentExtraction.findMany({
      where: { documentVersionId: version.id },
      include: { requestedBy: { select: actorSelect }, _count: { select: { fragments: true } } },
      orderBy: { createdAt: "desc" }
    });
    return { extractions: extractions.map((extraction) => serializeExtraction(extraction)) };
  });

  app.get("/api/knowledge/extractions/:extractionId", { preHandler: requirePermission("knowledge.read") }, async (request) => {
    const { extractionId } = z.object({ extractionId: z.string() }).parse(request.params);
    const extraction = await prisma.knowledgeDocumentExtraction.findUniqueOrThrow({
      where: { id: extractionId },
      include: {
        requestedBy: { select: actorSelect },
        fragments: { orderBy: { ordinal: "asc" } },
        documentVersion: { select: { id: true, versionNumber: true, documentId: true } }
      }
    });
    return { extraction: serializeExtraction(extraction, true) };
  });

  app.post("/api/knowledge/documents/:id/versions/:versionId/extractions", { preHandler: requirePermission("knowledge.extract") }, async (request, reply) => {
    if (!config.KNOWLEDGE_EXTRACTION_ENABLED) {
      return reply.code(503).send({ error: "Knowledge extraction is disabled until the production extractor is configured" });
    }
    const current = request.currentUser!;
    const params = z.object({ id: z.string(), versionId: z.string() }).parse(request.params);
    const version = await prisma.knowledgeDocumentVersion.findFirstOrThrow({
      where: { id: params.versionId, documentId: params.id },
      include: { document: true, fileObject: true }
    });
    if (version.document.lifecycleStatus !== "ACTIVE") {
      return reply.code(409).send({ error: "Archived documents must be restored before extraction" });
    }
    if (version.fileObject.securityStatus === "REJECTED") {
      return reply.code(409).send({ error: "Security-rejected files cannot be extracted" });
    }
    if (!version.fileObject.storageKey) {
      return reply.code(409).send({ error: "The source file is not available in private storage" });
    }
    const extractorName = version.fileObject.fileExtension === "pdf" ? "poppler-pdftotext" : "builtin-text";
    const extraction = await prisma.knowledgeDocumentExtraction.create({ data: {
      documentVersionId: version.id,
      requestedByUserId: current.user.id,
      status: "RUNNING",
      extractorName,
      extractorVersion: "1",
      sourceSha256: version.fileObject.sha256Hash
    } });
    try {
      const buffer = await readFile(version.fileObject.storageKey);
      const result = await extractKnowledgeText(buffer, version.fileObject.fileExtension);
      const completed = await prisma.$transaction(async (tx) => {
        await tx.knowledgeExtractionFragment.createMany({ data: result.fragments.map((fragment) => ({
          id: nanoid(24),
          extractionId: extraction.id,
          ...fragment
        })) });
        const updated = await tx.knowledgeDocumentExtraction.update({ where: { id: extraction.id }, data: {
          status: "SUCCEEDED",
          extractorName: result.extractorName,
          extractorVersion: result.extractorVersion,
          contentHash: result.contentHash,
          pageCount: result.pageCount,
          fragmentCount: result.fragments.length,
          characterCount: result.characterCount,
          completedAt: new Date()
        }, include: { requestedBy: { select: actorSelect }, _count: { select: { fragments: true } } } });
        await tx.auditEvent.create({ data: {
          actorUserId: current.user.id,
          action: "knowledge.extraction_succeeded",
          entityType: "knowledge_extraction",
          entityId: extraction.id,
          summary: "Deterministic source extraction completed",
          metadata: {
            documentId: version.documentId,
            versionId: version.id,
            extractorName: result.extractorName,
            fragmentCount: result.fragments.length,
            characterCount: result.characterCount
          }
        } });
        return updated;
      });
      return reply.code(201).send({ extraction: serializeExtraction(completed) });
    } catch (error) {
      const extractionError = error instanceof KnowledgeExtractionError
        ? error
        : new KnowledgeExtractionError("EXTRACTION_FAILED", "Source extraction failed");
      const status = extractionError.unsupported ? "UNSUPPORTED" : "FAILED";
      const failed = await prisma.$transaction(async (tx) => {
        const updated = await tx.knowledgeDocumentExtraction.update({ where: { id: extraction.id }, data: {
          status,
          errorCode: extractionError.code,
          errorMessage: extractionError.message,
          completedAt: new Date()
        }, include: { requestedBy: { select: actorSelect }, _count: { select: { fragments: true } } } });
        await tx.auditEvent.create({ data: {
          actorUserId: current.user.id,
          action: status === "UNSUPPORTED" ? "knowledge.extraction_unsupported" : "knowledge.extraction_failed",
          entityType: "knowledge_extraction",
          entityId: extraction.id,
          summary: status === "UNSUPPORTED" ? "Source extraction is not supported" : "Source extraction failed",
          metadata: { documentId: version.documentId, versionId: version.id, errorCode: extractionError.code }
        } });
        return updated;
      });
      return reply.code(422).send({ extraction: serializeExtraction(failed), error: extractionError.message });
    }
  });
}

function serializeExtraction(extraction: any, includeFragments = false) {
  return {
    id: extraction.id,
    documentVersionId: extraction.documentVersionId,
    status: extraction.status,
    extractorName: extraction.extractorName,
    extractorVersion: extraction.extractorVersion,
    contentHash: extraction.contentHash,
    pageCount: extraction.pageCount,
    fragmentCount: extraction.fragmentCount ?? extraction._count?.fragments ?? 0,
    characterCount: extraction.characterCount,
    errorCode: extraction.errorCode,
    errorMessage: extraction.errorMessage,
    startedAt: extraction.startedAt,
    completedAt: extraction.completedAt,
    createdAt: extraction.createdAt,
    requestedBy: extraction.requestedBy,
    documentVersion: extraction.documentVersion,
    ...(includeFragments ? { fragments: extraction.fragments.map((fragment: any) => ({
      id: fragment.id,
      ordinal: fragment.ordinal,
      pageNumber: fragment.pageNumber,
      sectionHeading: fragment.sectionHeading,
      content: fragment.content,
      contentHash: fragment.contentHash,
      characterCount: fragment.characterCount
    })) } : {})
  };
}
