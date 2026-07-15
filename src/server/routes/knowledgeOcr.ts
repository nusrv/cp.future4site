import type { FastifyInstance } from "fastify";
import { Prisma, type KnowledgeOcrJob } from "@prisma/client";
import { nanoid } from "nanoid";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { requirePermission } from "../security/auth.js";
import { KnowledgeOcrError, runKnowledgeOcr } from "../services/knowledgeOcr.js";
import { readFile } from "../services/storage.js";

const actorSelect = { id: true, displayName: true, username: true };
const requestSchema = z.object({ languages: z.enum(["eng", "ara", "eng+ara"]) }).strict();

export async function knowledgeOcrRoutes(app: FastifyInstance) {
  app.get("/api/knowledge/documents/:id/versions/:versionId/ocr-jobs", { preHandler: requirePermission("knowledge.read") }, async (request) => {
    const params = z.object({ id: z.string(), versionId: z.string() }).parse(request.params);
    const version = await prisma.knowledgeDocumentVersion.findFirstOrThrow({
      where: { id: params.versionId, documentId: params.id },
      select: { id: true }
    });
    const jobs = await prisma.knowledgeOcrJob.findMany({
      where: { documentVersionId: version.id },
      include: { requestedBy: { select: actorSelect }, _count: { select: { pages: true } } },
      orderBy: { createdAt: "desc" }
    });
    return { jobs: jobs.map((job) => serializeOcrJob(job)) };
  });

  app.get("/api/knowledge/ocr-jobs/:jobId", { preHandler: requirePermission("knowledge.read") }, async (request) => {
    const { jobId } = z.object({ jobId: z.string() }).parse(request.params);
    const job = await prisma.knowledgeOcrJob.findUniqueOrThrow({
      where: { id: jobId },
      include: {
        requestedBy: { select: actorSelect },
        pages: { orderBy: { pageNumber: "asc" } },
        documentVersion: { select: { id: true, versionNumber: true, documentId: true } }
      }
    });
    return { job: serializeOcrJob(job, true) };
  });

  app.post("/api/knowledge/documents/:id/versions/:versionId/ocr-jobs", { preHandler: requirePermission("knowledge.ocr") }, async (request, reply) => {
    if (!config.KNOWLEDGE_OCR_ENABLED) {
      return reply.code(503).send({ error: "Knowledge OCR is disabled until the production engines are configured" });
    }
    const current = request.currentUser!;
    const params = z.object({ id: z.string(), versionId: z.string() }).parse(request.params);
    const body = requestSchema.parse(request.body);
    const version = await prisma.knowledgeDocumentVersion.findFirstOrThrow({
      where: { id: params.versionId, documentId: params.id },
      include: { document: true, fileObject: true }
    });
    if (version.document.lifecycleStatus !== "ACTIVE") {
      return reply.code(409).send({ error: "Archived documents must be restored before OCR" });
    }
    if (version.fileObject.securityStatus === "REJECTED") {
      return reply.code(409).send({ error: "Security-rejected files cannot be processed by OCR" });
    }
    if (!version.fileObject.storageKey) {
      return reply.code(409).send({ error: "The source file is not available in private storage" });
    }
    await prisma.knowledgeOcrJob.updateMany({
      where: {
        activeKey: version.id,
        status: "RUNNING",
        startedAt: { lt: new Date(Date.now() - config.KNOWLEDGE_OCR_TIMEOUT_MS * 2) }
      },
      data: {
        activeKey: null,
        status: "FAILED",
        errorCode: "STALE_JOB_RECOVERED",
        errorMessage: "An interrupted OCR job exceeded the recovery window",
        completedAt: new Date()
      }
    });
    let job: KnowledgeOcrJob;
    try {
      job = await prisma.knowledgeOcrJob.create({ data: {
        activeKey: version.id,
        documentVersionId: version.id,
        requestedByUserId: current.user.id,
        status: "RUNNING",
        engineName: "tesseract",
        engineVersion: "pending",
        languages: body.languages,
        sourceSha256: version.fileObject.sha256Hash
      } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return reply.code(409).send({ error: "OCR is already running for this source version" });
      }
      throw error;
    }
    try {
      const source = await readFile(version.fileObject.storageKey);
      const result = await runKnowledgeOcr(source, version.fileObject.fileExtension, body.languages);
      const completed = await prisma.$transaction(async (tx) => {
        await tx.knowledgeOcrPage.createMany({ data: result.pages.map((page) => ({
          id: nanoid(24),
          ocrJobId: job.id,
          ...page
        })) });
        const updated = await tx.knowledgeOcrJob.update({ where: { id: job.id }, data: {
          status: "SUCCEEDED",
          activeKey: null,
          engineVersion: result.engineVersion,
          pageCount: result.pages.length,
          characterCount: result.characterCount,
          averageConfidence: result.averageConfidence,
          durationMs: result.durationMs,
          completedAt: new Date()
        }, include: { requestedBy: { select: actorSelect }, _count: { select: { pages: true } } } });
        await tx.auditEvent.create({ data: {
          actorUserId: current.user.id,
          action: "knowledge.ocr_succeeded",
          entityType: "knowledge_ocr_job",
          entityId: job.id,
          summary: "Explicit source OCR completed",
          metadata: {
            documentId: version.documentId,
            versionId: version.id,
            languages: result.languages,
            pageCount: result.pages.length,
            lowConfidencePages: result.pages.filter((page) => page.lowConfidence).length,
            durationMs: result.durationMs
          }
        } });
        return updated;
      });
      return reply.code(201).send({ job: serializeOcrJob(completed) });
    } catch (error) {
      const ocrError = error instanceof KnowledgeOcrError
        ? error
        : new KnowledgeOcrError("OCR_FAILED", "OCR processing failed");
      const status = ocrError.unsupported ? "UNSUPPORTED" : "FAILED";
      const failed = await prisma.$transaction(async (tx) => {
        const updated = await tx.knowledgeOcrJob.update({ where: { id: job.id }, data: {
          status,
          activeKey: null,
          errorCode: ocrError.code,
          errorMessage: ocrError.message,
          completedAt: new Date()
        }, include: { requestedBy: { select: actorSelect }, _count: { select: { pages: true } } } });
        await tx.auditEvent.create({ data: {
          actorUserId: current.user.id,
          action: status === "UNSUPPORTED" ? "knowledge.ocr_unsupported" : "knowledge.ocr_failed",
          entityType: "knowledge_ocr_job",
          entityId: job.id,
          summary: status === "UNSUPPORTED" ? "Source OCR is not supported" : "Source OCR failed",
          metadata: { documentId: version.documentId, versionId: version.id, errorCode: ocrError.code }
        } });
        return updated;
      });
      return reply.code(422).send({ job: serializeOcrJob(failed), error: ocrError.message });
    }
  });
}

function serializeOcrJob(job: any, includePages = false) {
  return {
    id: job.id,
    documentVersionId: job.documentVersionId,
    status: job.status,
    engineName: job.engineName,
    engineVersion: job.engineVersion,
    languages: job.languages,
    pageCount: job.pageCount,
    characterCount: job.characterCount,
    averageConfidence: job.averageConfidence,
    durationMs: job.durationMs,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    requestedBy: job.requestedBy,
    documentVersion: job.documentVersion,
    ...(includePages ? { pages: job.pages.map((page: any) => ({
      id: page.id,
      pageNumber: page.pageNumber,
      content: page.content,
      contentHash: page.contentHash,
      characterCount: page.characterCount,
      confidence: page.confidence,
      lowConfidence: page.lowConfidence
    })) } : {})
  };
}
