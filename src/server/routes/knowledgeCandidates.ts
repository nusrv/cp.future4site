import type { FastifyInstance } from "fastify";
import { Prisma, type KnowledgeCandidateRun } from "@prisma/client";
import { nanoid } from "nanoid";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { sha256 } from "../security/crypto.js";
import { requirePermission } from "../security/auth.js";
import { generateKnowledgeCandidates, KnowledgeCandidateError, type CandidateInputFragment } from "../services/knowledgeCandidates.js";

const generateInput = z.object({
  sourceType: z.enum(["extraction", "ocr"]),
  sourceId: z.string(),
  fragmentIds: z.array(z.string()).min(1).max(100)
}).strict();

const applicabilitySchema = z.object({
  brandIds: z.array(z.string()).max(50),
  productIds: z.array(z.string()).max(100),
  packagingFormatIds: z.array(z.string()).max(100),
  markets: z.array(z.string().trim().min(1).max(120)).max(50),
  audiences: z.array(z.string().trim().min(1).max(120)).max(50),
  objectives: z.array(z.string().trim().min(1).max(120)).max(50)
}).strict();

const acceptInput = z.object({
  confirmUnapprovedSuggestion: z.literal(true),
  stableKey: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/),
  claimType: z.string().trim().min(2).max(120),
  usageScope: z.enum(["PUBLIC_SAFE", "INTERNAL_ONLY", "RESTRICTED"]),
  requiredLocales: z.array(z.enum(["en", "ar"])).min(1).max(2),
  translations: z.array(z.object({ locale: z.enum(["en", "ar"]), wording: z.string().trim().min(2).max(5000) }).strict()).min(1).max(2),
  effectiveAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  restrictions: z.string().trim().max(5000).optional().default(""),
  internalNotes: z.string().trim().max(5000).optional().default(""),
  applicability: applicabilitySchema
}).strict().refine((value) => !value.expiresAt || !value.effectiveAt || value.expiresAt > value.effectiveAt, {
  message: "Expiration must be after the effective date",
  path: ["expiresAt"]
});

const candidateInclude = {
  translations: { orderBy: { locale: "asc" as const } },
  sources: {
    include: {
      extractionFragment: { select: { id: true, pageNumber: true, ordinal: true, extraction: { select: { documentVersionId: true } } } },
      ocrPage: { select: { id: true, pageNumber: true, ocrJob: { select: { documentVersionId: true } } } }
    }
  },
  decidedBy: { select: { id: true, displayName: true, username: true } },
  acceptedClaim: { select: { id: true, stableKey: true, revision: true, status: true } }
};

export async function knowledgeCandidateRoutes(app: FastifyInstance) {
  app.get("/api/knowledge/candidate-runs", { preHandler: requirePermission("knowledge.read") }, async (request) => {
    const query = z.object({ sourceType: z.enum(["extraction", "ocr"]).optional(), sourceId: z.string().optional() }).parse(request.query);
    const runs = await prisma.knowledgeCandidateRun.findMany({
      where: {
        ...(query.sourceId && query.sourceType === "extraction" ? { extractionId: query.sourceId } : {}),
        ...(query.sourceId && query.sourceType === "ocr" ? { ocrJobId: query.sourceId } : {})
      },
      include: { requestedBy: { select: { id: true, displayName: true, username: true } }, _count: { select: { candidates: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return { runs: runs.map(serializeRun) };
  });

  app.get("/api/knowledge/candidate-runs/:runId", { preHandler: requirePermission("knowledge.read") }, async (request) => {
    const { runId } = z.object({ runId: z.string() }).parse(request.params);
    const run = await prisma.knowledgeCandidateRun.findUniqueOrThrow({
      where: { id: runId },
      include: {
        requestedBy: { select: { id: true, displayName: true, username: true } },
        candidates: { include: candidateInclude, orderBy: { ordinal: "asc" } }
      }
    });
    return { run: { ...serializeRun(run), candidates: run.candidates.map(serializeCandidate) } };
  });

  app.post("/api/knowledge/candidate-runs", { preHandler: requirePermission("knowledge.candidate.generate") }, async (request, reply) => {
    if (!config.KNOWLEDGE_CANDIDATES_ENABLED || !config.KNOWLEDGE_CANDIDATE_DATA_APPROVED || !config.GEMINI_API_KEY) {
      return reply.code(503).send({ error: "Candidate generation remains disabled until provider credentials and data handling are approved" });
    }
    const current = request.currentUser!;
    const input = generateInput.parse(request.body);
    let source: { fragments: CandidateInputFragment[] };
    try {
      source = await loadAuthorizedSource(input.sourceType, input.sourceId, input.fragmentIds);
    } catch (error) {
      if (error instanceof KnowledgeCandidateError) return reply.code(422).send({ error: error.message });
      throw error;
    }
    const activeKey = input.sourceType + ":" + input.sourceId;
    const serializedInput = JSON.stringify(source.fragments.map((fragment) => ({ fragmentId: fragment.id, pageNumber: fragment.pageNumber, text: fragment.content })));
    await prisma.knowledgeCandidateRun.updateMany({
      where: {
        activeKey,
        status: "RUNNING",
        startedAt: { lt: new Date(Date.now() - config.KNOWLEDGE_CANDIDATE_TIMEOUT_MS * 2) }
      },
      data: {
        activeKey: null,
        status: "FAILED",
        errorCode: "STALE_RUN_RECOVERED",
        errorMessage: "An interrupted candidate run exceeded the recovery window",
        completedAt: new Date()
      }
    });
    let run: KnowledgeCandidateRun;
    try {
      run = await prisma.knowledgeCandidateRun.create({ data: {
        activeKey,
        requestedByUserId: current.user.id,
        extractionId: input.sourceType === "extraction" ? input.sourceId : null,
        ocrJobId: input.sourceType === "ocr" ? input.sourceId : null,
        status: "RUNNING",
        provider: "gemini",
        model: config.KNOWLEDGE_GEMINI_MODEL,
        promptVersion: "knowledge-candidates-v1",
        inputHash: sha256(Buffer.from(serializedInput, "utf8"))
      } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return reply.code(409).send({ error: "Candidate generation is already running for this source result" });
      }
      throw error;
    }
    try {
      const result = await generateKnowledgeCandidates(source.fragments);
      const completed = await prisma.$transaction(async (tx) => {
        for (let index = 0; index < result.candidates.length; index += 1) {
          const candidate = result.candidates[index];
          await tx.knowledgeCandidateClaim.create({ data: {
            id: nanoid(24),
            runId: run.id,
            ordinal: index + 1,
            proposedStableKey: candidate.stableKey,
            proposedClaimType: candidate.claimType,
            explanation: candidate.explanation,
            confidence: candidate.confidence,
            translations: { create: candidate.translations.map((translation) => ({ id: nanoid(24), ...translation })) },
            sources: { create: candidate.sources.map((candidateSource) => ({
              id: nanoid(24),
              extractionFragmentId: input.sourceType === "extraction" ? candidateSource.fragmentId : null,
              ocrPageId: input.sourceType === "ocr" ? candidateSource.fragmentId : null,
              sourceExcerpt: candidateSource.sourceExcerpt || null
            })) }
          } });
        }
        const updated = await tx.knowledgeCandidateRun.update({ where: { id: run.id }, data: {
          activeKey: null,
          status: "SUCCEEDED",
          candidateCount: result.candidates.length,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          durationMs: result.durationMs,
          completedAt: new Date()
        }, include: { requestedBy: { select: { id: true, displayName: true, username: true } }, _count: { select: { candidates: true } } } });
        await tx.auditEvent.create({ data: {
          actorUserId: current.user.id,
          action: "knowledge.candidates_generated",
          entityType: "knowledge_candidate_run",
          entityId: run.id,
          summary: "Unapproved claim candidates generated",
          metadata: { sourceType: input.sourceType, sourceId: input.sourceId, model: result.model, promptVersion: result.promptVersion, candidateCount: result.candidates.length }
        } });
        return updated;
      });
      return reply.code(201).send({ run: serializeRun(completed) });
    } catch (error) {
      const candidateError = error instanceof KnowledgeCandidateError
        ? error
        : new KnowledgeCandidateError("CANDIDATE_GENERATION_FAILED", "Candidate generation failed");
      const failed = await prisma.knowledgeCandidateRun.update({ where: { id: run.id }, data: {
        activeKey: null,
        status: "FAILED",
        errorCode: candidateError.code,
        errorMessage: candidateError.message,
        completedAt: new Date()
      } });
      await prisma.auditEvent.create({ data: {
        actorUserId: current.user.id,
        action: "knowledge.candidate_generation_failed",
        entityType: "knowledge_candidate_run",
        entityId: run.id,
        summary: "Unapproved candidate generation failed",
        metadata: { sourceType: input.sourceType, sourceId: input.sourceId, errorCode: candidateError.code }
      } });
      return reply.code(422).send({ run: serializeRun(failed), error: candidateError.message });
    }
  });

  app.post("/api/knowledge/candidates/:candidateId/reject", { preHandler: requirePermission("knowledge.candidate.review") }, async (request, reply) => {
    const current = request.currentUser!;
    const { candidateId } = z.object({ candidateId: z.string() }).parse(request.params);
    const { reason } = z.object({ reason: z.string().trim().min(2).max(2000) }).strict().parse(request.body);
    const result = await prisma.knowledgeCandidateClaim.updateMany({
      where: { id: candidateId, status: "PROPOSED" },
      data: { status: "REJECTED", decidedByUserId: current.user.id, decidedAt: new Date(), decisionReason: reason }
    });
    if (result.count !== 1) return reply.code(409).send({ error: "Candidate has already been decided" });
    await prisma.auditEvent.create({ data: {
      actorUserId: current.user.id,
      action: "knowledge.candidate_rejected",
      entityType: "knowledge_candidate",
      entityId: candidateId,
      summary: "Unapproved claim candidate rejected",
      metadata: { candidateId }
    } });
    return { candidate: serializeCandidate(await prisma.knowledgeCandidateClaim.findUniqueOrThrow({ where: { id: candidateId }, include: candidateInclude })) };
  });

  app.post("/api/knowledge/candidates/:candidateId/accept-draft", { preHandler: requirePermission("knowledge.claim.create") }, async (request, reply) => {
    const current = request.currentUser!;
    const { candidateId } = z.object({ candidateId: z.string() }).parse(request.params);
    const input = acceptInput.parse(request.body);
    const requiredLocales = [...new Set(input.requiredLocales)];
    const translationLocales = input.translations.map((translation) => translation.locale);
    if (requiredLocales.length !== input.requiredLocales.length || new Set(translationLocales).size !== translationLocales.length) {
      return reply.code(422).send({ error: "Required locales and translations must be unique" });
    }
    if (requiredLocales.some((locale) => !translationLocales.includes(locale))) {
      return reply.code(422).send({ error: "Every required locale needs operator-confirmed wording" });
    }
    const applicabilityCount = Object.values(input.applicability).reduce((count, values) => count + values.length, 0);
    if (!applicabilityCount) return reply.code(422).send({ error: "Explicit applicability is required before creating a claim draft" });
    const candidate = await prisma.knowledgeCandidateClaim.findUniqueOrThrow({ where: { id: candidateId }, include: candidateInclude });
    const sourceRows = candidate.sources.map((source: any) => ({
      documentVersionId: source.extractionFragment?.extraction.documentVersionId ?? source.ocrPage?.ocrJob.documentVersionId,
      pageNumber: source.extractionFragment?.pageNumber ?? source.ocrPage?.pageNumber ?? null,
      sourceExcerpt: source.sourceExcerpt || null
    }));
    if (!sourceRows.length || sourceRows.some((source: any) => !source.documentVersionId)) {
      return reply.code(422).send({ error: "Candidate provenance is incomplete" });
    }
    const approvedSourceCount = await prisma.knowledgeDocumentVersion.count({
      where: { id: { in: [...new Set(sourceRows.map((source: any) => source.documentVersionId))] }, reviewStatus: "APPROVED_SOURCE" }
    });
    if (approvedSourceCount !== new Set(sourceRows.map((source: any) => source.documentVersionId)).size) {
      return reply.code(422).send({ error: "All candidate provenance must still reference approved source versions" });
    }
    try {
      const claim = await prisma.$transaction(async (tx) => {
        const decided = await tx.knowledgeCandidateClaim.updateMany({
          where: { id: candidateId, status: "PROPOSED", acceptedClaimId: null },
          data: { status: "ACCEPTED", decidedByUserId: current.user.id, decidedAt: new Date() }
        });
        if (decided.count !== 1) throw new KnowledgeCandidateError("CANDIDATE_ALREADY_DECIDED", "Candidate has already been decided");
        const created = await tx.knowledgeClaim.create({ data: {
          stableKey: input.stableKey,
          claimType: input.claimType,
          usageScope: input.usageScope,
          requiredLocales,
          effectiveAt: input.effectiveAt,
          expiresAt: input.expiresAt,
          restrictions: input.restrictions || null,
          internalNotes: input.internalNotes || null,
          createdByUserId: current.user.id,
          lastEditedByUserId: current.user.id,
          translations: { create: input.translations.map((translation) => ({ locale: translation.locale, wording: translation.wording })) },
          sources: { create: sourceRows },
          brands: { create: [...new Set(input.applicability.brandIds)].map((brandId) => ({ brandId })) },
          products: { create: [...new Set(input.applicability.productIds)].map((productId) => ({ productId })) },
          packagingFormats: { create: [...new Set(input.applicability.packagingFormatIds)].map((packagingFormatId) => ({ packagingFormatId })) },
          markets: { create: [...new Set(input.applicability.markets)].map((value) => ({ value })) },
          audiences: { create: [...new Set(input.applicability.audiences)].map((value) => ({ value })) },
          objectives: { create: [...new Set(input.applicability.objectives)].map((value) => ({ value })) }
        } });
        await tx.knowledgeCandidateClaim.update({ where: { id: candidateId }, data: { acceptedClaimId: created.id } });
        await tx.auditEvent.createMany({ data: [
          {
            actorUserId: current.user.id,
            action: "knowledge.candidate_accepted_as_draft",
            entityType: "knowledge_candidate",
            entityId: candidateId,
            summary: "Unapproved candidate accepted into a claim draft",
            metadata: { candidateId, claimId: created.id, stableKey: created.stableKey }
          },
          {
            actorUserId: current.user.id,
            action: "knowledge.claim_created",
            entityType: "knowledge_claim",
            entityId: created.id,
            summary: "Knowledge claim draft created from an unapproved candidate",
            metadata: { stableKey: created.stableKey, revision: created.revision, candidateId, sourceVersionIds: sourceRows.map((source: any) => source.documentVersionId) }
          }
        ] });
        return created;
      });
      return reply.code(201).send({ claim: { id: claim.id, stableKey: claim.stableKey, revision: claim.revision, status: claim.status } });
    } catch (error) {
      if (error instanceof KnowledgeCandidateError && error.code === "CANDIDATE_ALREADY_DECIDED") {
        return reply.code(409).send({ error: error.message });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return reply.code(409).send({ error: "The stable claim key already exists; create a revision through the claim workflow instead" });
      }
      throw error;
    }
  });
}

async function loadAuthorizedSource(sourceType: "extraction" | "ocr", sourceId: string, fragmentIds: string[]) {
  const uniqueIds = [...new Set(fragmentIds)];
  if (sourceType === "extraction") {
    const extraction = await prisma.knowledgeDocumentExtraction.findUniqueOrThrow({
      where: { id: sourceId },
      include: {
        documentVersion: { include: { document: { select: { lifecycleStatus: true } } } },
        fragments: { where: { id: { in: uniqueIds } }, orderBy: { ordinal: "asc" } }
      }
    });
    assertAuthorizedResult(extraction.status, extraction.documentVersion.reviewStatus, extraction.documentVersion.document.lifecycleStatus);
    if (extraction.fragments.length !== uniqueIds.length) throw new KnowledgeCandidateError("INVALID_SOURCE_SELECTION", "One or more extraction fragments are unavailable");
    return { fragments: extraction.fragments.map((fragment) => ({ id: fragment.id, pageNumber: fragment.pageNumber, content: fragment.content })) satisfies CandidateInputFragment[] };
  }
  const ocr = await prisma.knowledgeOcrJob.findUniqueOrThrow({
    where: { id: sourceId },
    include: {
      documentVersion: { include: { document: { select: { lifecycleStatus: true } } } },
      pages: { where: { id: { in: uniqueIds } }, orderBy: { pageNumber: "asc" } }
    }
  });
  assertAuthorizedResult(ocr.status, ocr.documentVersion.reviewStatus, ocr.documentVersion.document.lifecycleStatus);
  if (ocr.pages.length !== uniqueIds.length) throw new KnowledgeCandidateError("INVALID_SOURCE_SELECTION", "One or more OCR pages are unavailable");
  return { fragments: ocr.pages.map((page) => ({ id: page.id, pageNumber: page.pageNumber, content: page.content })) satisfies CandidateInputFragment[] };
}

function assertAuthorizedResult(status: string, reviewStatus: string, lifecycleStatus: string) {
  if (status !== "SUCCEEDED") throw new KnowledgeCandidateError("SOURCE_NOT_READY", "The selected source result has not completed successfully");
  if (reviewStatus !== "APPROVED_SOURCE") throw new KnowledgeCandidateError("SOURCE_NOT_APPROVED", "Candidate generation requires an approved source version");
  if (lifecycleStatus !== "ACTIVE") throw new KnowledgeCandidateError("SOURCE_ARCHIVED", "Archived documents cannot start candidate generation");
}

function serializeRun(run: any) {
  return {
    id: run.id,
    status: run.status,
    provider: run.provider,
    model: run.model,
    promptVersion: run.promptVersion,
    candidateCount: run.candidateCount ?? run._count?.candidates ?? 0,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    durationMs: run.durationMs,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    createdAt: run.createdAt,
    requestedBy: run.requestedBy
  };
}

function serializeCandidate(candidate: any) {
  return {
    id: candidate.id,
    ordinal: candidate.ordinal,
    status: candidate.status,
    proposedStableKey: candidate.proposedStableKey,
    proposedClaimType: candidate.proposedClaimType,
    explanation: candidate.explanation,
    confidence: candidate.confidence,
    translations: candidate.translations,
    sources: candidate.sources.map((source: any) => ({
      id: source.id,
      extractionFragmentId: source.extractionFragmentId,
      ocrPageId: source.ocrPageId,
      pageNumber: source.extractionFragment?.pageNumber ?? source.ocrPage?.pageNumber ?? null,
      sourceExcerpt: source.sourceExcerpt
    })),
    decidedBy: candidate.decidedBy,
    decidedAt: candidate.decidedAt,
    decisionReason: candidate.decisionReason,
    acceptedClaim: candidate.acceptedClaim,
    createdAt: candidate.createdAt
  };
}
