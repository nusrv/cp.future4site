import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requirePermission } from "../security/auth.js";
import { isFuturePublicEligible } from "../../shared/knowledgeClaims.js";

const localeSchema = z.string().trim().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);
const textList = z.array(z.string().trim().min(1).max(160)).max(50).default([]);
const idList = z.array(z.string().min(1)).max(100).default([]);
const translationInput = z.object({ locale: localeSchema, wording: z.string().trim().min(2).max(10000) });
const sourceInput = z.object({
  documentVersionId: z.string().min(1),
  pageNumber: z.number().int().positive().optional(),
  sectionHeading: z.string().trim().max(500).optional().default(""),
  tableFigureReference: z.string().trim().max(500).optional().default(""),
  sourceExcerpt: z.string().trim().max(3000).optional().default(""),
  sourceNotes: z.string().trim().max(3000).optional().default("")
});
const applicabilitySchema = z.object({
  brandIds: idList,
  productIds: idList,
  packagingFormatIds: idList,
  markets: textList,
  audiences: textList,
  objectives: textList
});
const claimInput = z.object({
  stableKey: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/),
  claimType: z.string().trim().min(2).max(120),
  usageScope: z.enum(["PUBLIC_SAFE", "INTERNAL_ONLY", "RESTRICTED"]),
  requiredLocales: z.array(localeSchema).min(1).max(10),
  effectiveAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  restrictions: z.string().trim().max(5000).optional().default(""),
  internalNotes: z.string().trim().max(5000).optional().default(""),
  translations: z.array(translationInput).min(1).max(10),
  sources: z.array(sourceInput).min(1).max(25),
  applicability: applicabilitySchema
}).refine((value) => !value.expiresAt || !value.effectiveAt || value.expiresAt > value.effectiveAt, {
  message: "Expiration must be after the effective date",
  path: ["expiresAt"]
});

const claimInclude = {
  createdBy: { select: { id: true, displayName: true, username: true } },
  lastEditedBy: { select: { id: true, displayName: true, username: true } },
  reviewedBy: { select: { id: true, displayName: true, username: true } },
  approvedBy: { select: { id: true, displayName: true, username: true } },
  translations: {
    include: {
      reviewedBy: { select: { id: true, displayName: true, username: true } },
      approvedBy: { select: { id: true, displayName: true, username: true } }
    },
    orderBy: { locale: "asc" as const }
  },
  sources: {
    include: {
      documentVersion: {
        include: {
          document: { select: { id: true, title: true, lifecycleStatus: true } },
          fileObject: { select: { originalName: true } }
        }
      }
    }
  },
  brands: { include: { brand: true } },
  products: { include: { product: true } },
  packagingFormats: { include: { packagingFormat: true } },
  markets: true,
  audiences: true,
  objectives: true,
  supersedes: { select: { id: true, stableKey: true, revision: true, status: true } },
  supersededBy: { select: { id: true, stableKey: true, revision: true, status: true } }
};

export async function knowledgeClaimRoutes(app: FastifyInstance) {
  app.get("/api/knowledge/claim-reference-data", { preHandler: requirePermission("knowledge.read") }, async () => {
    const [brands, products, packagingFormats] = await Promise.all([
      prisma.brand.findMany({ where: { status: "active" }, orderBy: { name: "asc" } }),
      prisma.product.findMany({ where: { status: "active" }, include: { brand: true }, orderBy: { name: "asc" } }),
      prisma.packagingFormat.findMany({ where: { status: "approved" }, orderBy: { label: "asc" } })
    ]);
    return { brands, products, packagingFormats };
  });

  app.get("/api/knowledge/claims", { preHandler: requirePermission("knowledge.read") }, async (request) => {
    const query = z.object({
      status: z.enum(["DRAFT", "UNDER_REVIEW", "APPROVED", "REJECTED", "SUPERSEDED", "EXPIRED"]).optional(),
      usageScope: z.enum(["PUBLIC_SAFE", "INTERNAL_ONLY", "RESTRICTED"]).optional(),
      sourceVersionId: z.string().optional(),
      search: z.string().trim().max(200).optional()
    }).parse(request.query);
    const claims = await prisma.knowledgeClaim.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.usageScope ? { usageScope: query.usageScope } : {}),
        ...(query.sourceVersionId ? { sources: { some: { documentVersionId: query.sourceVersionId } } } : {}),
        ...(query.search ? { OR: [
          { stableKey: { contains: query.search } },
          { claimType: { contains: query.search } },
          { translations: { some: { wording: { contains: query.search } } } }
        ] } : {})
      },
      include: claimInclude,
      orderBy: { updatedAt: "desc" },
      take: 250
    });
    return { claims: claims.map(serializeClaim) };
  });

  app.post("/api/knowledge/claims", { preHandler: requirePermission("knowledge.claim.create") }, async (request, reply) => {
    const current = request.currentUser!;
    const input = claimInput.parse(request.body);
    assertRequiredTranslations(input.requiredLocales, input.translations);
    assertApplicability(input.applicability);
    await assertSourceVersions(input.sources.map((source) => source.documentVersionId));
    const claim = await prisma.$transaction(async (tx) => {
      const created = await tx.knowledgeClaim.create({ data: {
        stableKey: input.stableKey,
        claimType: input.claimType,
        usageScope: input.usageScope,
        requiredLocales: unique(input.requiredLocales),
        effectiveAt: input.effectiveAt,
        expiresAt: input.expiresAt,
        restrictions: input.restrictions || null,
        internalNotes: input.internalNotes || null,
        createdByUserId: current.user.id,
        lastEditedByUserId: current.user.id,
        translations: { create: input.translations.map((translation) => ({ locale: translation.locale, wording: translation.wording })) },
        sources: { create: sourceRows(input.sources) },
        brands: { create: unique(input.applicability.brandIds).map((brandId) => ({ brandId })) },
        products: { create: unique(input.applicability.productIds).map((productId) => ({ productId })) },
        packagingFormats: { create: unique(input.applicability.packagingFormatIds).map((packagingFormatId) => ({ packagingFormatId })) },
        markets: { create: unique(input.applicability.markets).map((value) => ({ value })) },
        audiences: { create: unique(input.applicability.audiences).map((value) => ({ value })) },
        objectives: { create: unique(input.applicability.objectives).map((value) => ({ value })) }
      } });
      await tx.auditEvent.create({ data: {
        actorUserId: current.user.id,
        action: "knowledge.claim_created",
        entityType: "knowledge_claim",
        entityId: created.id,
        summary: "Manual knowledge claim created",
        metadata: { stableKey: created.stableKey, revision: created.revision, sourceVersionIds: input.sources.map((source) => source.documentVersionId) }
      } });
      return tx.knowledgeClaim.findUniqueOrThrow({ where: { id: created.id }, include: claimInclude });
    });
    return reply.code(201).send({ claim: serializeClaim(claim) });
  });

  app.get("/api/knowledge/claims/:id", { preHandler: requirePermission("knowledge.read") }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const [claim, auditEvents] = await Promise.all([
      prisma.knowledgeClaim.findUniqueOrThrow({ where: { id }, include: claimInclude }),
      prisma.auditEvent.findMany({
        where: { entityType: "knowledge_claim", entityId: id },
        include: { actor: { select: { displayName: true, username: true } } },
        orderBy: { createdAt: "desc" },
        take: 100
      })
    ]);
    return { claim: serializeClaim(claim), auditEvents };
  });

  app.patch("/api/knowledge/claims/:id", { preHandler: requirePermission("knowledge.claim.edit") }, async (request) => {
    const current = request.currentUser!;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z.object({
      claimType: z.string().trim().min(2).max(120).optional(),
      usageScope: z.enum(["PUBLIC_SAFE", "INTERNAL_ONLY", "RESTRICTED"]).optional(),
      requiredLocales: z.array(localeSchema).min(1).max(10).optional(),
      effectiveAt: z.coerce.date().nullable().optional(),
      expiresAt: z.coerce.date().nullable().optional(),
      restrictions: z.string().trim().max(5000).nullable().optional(),
      internalNotes: z.string().trim().max(5000).nullable().optional(),
      applicability: applicabilitySchema.optional()
    }).strict().parse(request.body);
    const existing = await prisma.knowledgeClaim.findUniqueOrThrow({ where: { id }, include: { translations: true } });
    assertEditable(existing.status);
    if (input.requiredLocales) assertRequiredTranslations(input.requiredLocales, existing.translations);
    if (input.applicability) assertApplicability(input.applicability);
    const claim = await prisma.$transaction(async (tx) => {
      await tx.knowledgeClaim.update({ where: { id }, data: {
        claimType: input.claimType,
        usageScope: input.usageScope,
        requiredLocales: input.requiredLocales ? unique(input.requiredLocales) : undefined,
        effectiveAt: input.effectiveAt,
        expiresAt: input.expiresAt,
        restrictions: input.restrictions,
        internalNotes: input.internalNotes,
        lastEditedByUserId: current.user.id,
        status: existing.status === "REJECTED" ? "DRAFT" : undefined,
        rejectionReason: existing.status === "REJECTED" ? null : undefined
      } });
      if (input.applicability) await replaceApplicability(tx, id, input.applicability);
      const fields = Object.keys(input);
      await tx.auditEvent.createMany({ data: [
        {
          actorUserId: current.user.id,
          action: "knowledge.claim_edited",
          entityType: "knowledge_claim",
          entityId: id,
          summary: "Manual knowledge claim edited",
          metadata: { stableKey: existing.stableKey, fields }
        },
        ...(input.usageScope ? [{
          actorUserId: current.user.id, action: "knowledge.claim_visibility_changed", entityType: "knowledge_claim",
          entityId: id, summary: "Claim usage scope changed", metadata: { stableKey: existing.stableKey, usageScope: input.usageScope }
        }] : []),
        ...(input.applicability ? [{
          actorUserId: current.user.id, action: "knowledge.claim_applicability_changed", entityType: "knowledge_claim",
          entityId: id, summary: "Claim applicability changed", metadata: applicabilityAudit(input.applicability)
        }] : [])
      ] });
      return tx.knowledgeClaim.findUniqueOrThrow({ where: { id }, include: claimInclude });
    });
    return { claim: serializeClaim(claim) };
  });

  app.post("/api/knowledge/claims/:id/translations", { preHandler: requirePermission("knowledge.claim.edit") }, upsertTranslation);
  app.patch("/api/knowledge/claims/:id/translations/:locale", { preHandler: requirePermission("knowledge.claim.edit") }, upsertTranslation);

  app.post("/api/knowledge/claims/:id/translations/:locale/submit-review", { preHandler: requirePermission("knowledge.claim.edit") }, async (request) => {
    return transitionTranslation(request, "UNDER_REVIEW");
  });
  app.post("/api/knowledge/claims/:id/translations/:locale/approve", { preHandler: requirePermission("knowledge.claim.approve") }, async (request) => {
    return transitionTranslation(request, "APPROVED");
  });
  app.post("/api/knowledge/claims/:id/translations/:locale/reject", { preHandler: requirePermission("knowledge.claim.review") }, async (request) => {
    return transitionTranslation(request, "REJECTED");
  });

  app.post("/api/knowledge/claims/:id/submit-review", { preHandler: requirePermission("knowledge.claim.edit") }, async (request) => {
    return transitionClaim(request, "UNDER_REVIEW");
  });
  app.post("/api/knowledge/claims/:id/approve", { preHandler: requirePermission("knowledge.claim.approve") }, async (request) => {
    return transitionClaim(request, "APPROVED");
  });
  app.post("/api/knowledge/claims/:id/reject", { preHandler: requirePermission("knowledge.claim.review") }, async (request) => {
    return transitionClaim(request, "REJECTED");
  });
  app.post("/api/knowledge/claims/:id/supersede", { preHandler: requirePermission("knowledge.claim.create") }, supersedeClaim);
}

async function upsertTranslation(request: FastifyRequest) {
  const current = request.currentUser!;
  const params = z.object({ id: z.string(), locale: localeSchema.optional() }).parse(request.params);
  const input = translationInput.parse({ ...(request.body as object), locale: params.locale ?? (request.body as any)?.locale });
  const claim = await prisma.knowledgeClaim.findUniqueOrThrow({ where: { id: params.id } });
  assertEditable(claim.status);
  await prisma.$transaction(async (tx) => {
    await tx.knowledgeClaimTranslation.upsert({
      where: { claimId_locale: { claimId: params.id, locale: input.locale } },
      create: { claimId: params.id, locale: input.locale, wording: input.wording },
      update: {
        wording: input.wording, reviewStatus: "DRAFT", reviewedByUserId: null, reviewedAt: null,
        approvedByUserId: null, approvedAt: null, reviewNotes: null, rejectionReason: null
      }
    });
    await tx.knowledgeClaim.update({ where: { id: params.id }, data: { lastEditedByUserId: current.user.id } });
    await tx.auditEvent.create({ data: {
      actorUserId: current.user.id, action: "knowledge.claim_translation_edited", entityType: "knowledge_claim",
      entityId: params.id, summary: "Localized claim wording added or edited", metadata: { stableKey: claim.stableKey, locale: input.locale }
    } });
  });
  return getClaim(params.id);
}

async function transitionTranslation(request: FastifyRequest, next: "UNDER_REVIEW" | "APPROVED" | "REJECTED") {
  const current = request.currentUser!;
  const params = z.object({ id: z.string(), locale: localeSchema }).parse(request.params);
  const input = z.object({ notes: z.string().trim().max(5000).optional().default(""), rejectionReason: z.string().trim().max(5000).optional().default("") }).parse(request.body ?? {});
  const claim = await prisma.knowledgeClaim.findUniqueOrThrow({ where: { id: params.id } });
  const translation = await prisma.knowledgeClaimTranslation.findUniqueOrThrow({ where: { claimId_locale: { claimId: params.id, locale: params.locale } } });
  const allowed = next === "UNDER_REVIEW" ? ["DRAFT", "REJECTED"] : ["UNDER_REVIEW"];
  if (!allowed.includes(translation.reviewStatus)) throw conflict("Invalid translation review transition");
  if (next === "REJECTED" && input.rejectionReason.length < 2) throw badRequest("A rejection reason is required");
  if (next === "APPROVED") assertNoSelfApproval(current, claim);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.knowledgeClaimTranslation.update({ where: { id: translation.id }, data: {
      reviewStatus: next,
      reviewedByUserId: next === "UNDER_REVIEW" ? null : current.user.id,
      reviewedAt: next === "UNDER_REVIEW" ? null : now,
      approvedByUserId: next === "APPROVED" ? current.user.id : null,
      approvedAt: next === "APPROVED" ? now : null,
      reviewNotes: input.notes || null,
      rejectionReason: next === "REJECTED" ? input.rejectionReason : null
    } });
    await tx.auditEvent.create({ data: {
      actorUserId: current.user.id,
      action: next === "UNDER_REVIEW" ? "knowledge.claim_translation_review_submitted" : next === "APPROVED" ? "knowledge.claim_translation_approved" : "knowledge.claim_translation_rejected",
      entityType: "knowledge_claim", entityId: claim.id, summary: "Localized claim wording review status changed",
      metadata: { stableKey: claim.stableKey, locale: params.locale, from: translation.reviewStatus, to: next }
    } });
  });
  return getClaim(claim.id);
}

async function transitionClaim(request: FastifyRequest, next: "UNDER_REVIEW" | "APPROVED" | "REJECTED") {
  const current = request.currentUser!;
  const { id } = z.object({ id: z.string() }).parse(request.params);
  const input = z.object({ notes: z.string().trim().max(5000).optional().default(""), rejectionReason: z.string().trim().max(5000).optional().default("") }).parse(request.body ?? {});
  const claim = await prisma.knowledgeClaim.findUniqueOrThrow({ where: { id }, include: claimInclude });
  const allowed = next === "UNDER_REVIEW" ? ["DRAFT", "REJECTED"] : ["UNDER_REVIEW"];
  if (!allowed.includes(claim.status)) throw conflict("Invalid claim review transition");
  if (next === "REJECTED" && input.rejectionReason.length < 2) throw badRequest("A rejection reason is required");
  if (next === "APPROVED") {
    assertNoSelfApproval(current, claim);
    assertApprovalRequirements(claim);
  }
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.knowledgeClaim.update({ where: { id }, data: {
      status: next,
      reviewedByUserId: next === "UNDER_REVIEW" ? null : current.user.id,
      reviewedAt: next === "UNDER_REVIEW" ? null : now,
      approvedByUserId: next === "APPROVED" ? current.user.id : null,
      approvedAt: next === "APPROVED" ? now : null,
      reviewNotes: input.notes || null,
      rejectionReason: next === "REJECTED" ? input.rejectionReason : null
    } });
    if (next === "APPROVED" && claim.supersedesClaimId) {
      await tx.knowledgeClaim.update({ where: { id: claim.supersedesClaimId }, data: { status: "SUPERSEDED" } });
      await tx.auditEvent.create({ data: {
        actorUserId: current.user.id, action: "knowledge.claim_superseded", entityType: "knowledge_claim",
        entityId: claim.supersedesClaimId, summary: "Approved claim superseded by an approved replacement revision",
        metadata: { stableKey: claim.stableKey, replacementClaimId: claim.id, revision: claim.revision }
      } });
    }
    await tx.auditEvent.create({ data: {
      actorUserId: current.user.id,
      action: next === "UNDER_REVIEW" ? "knowledge.claim_review_submitted" : next === "APPROVED" ? "knowledge.claim_approved" : "knowledge.claim_rejected",
      entityType: "knowledge_claim", entityId: id, summary: "Knowledge claim review status changed",
      metadata: { stableKey: claim.stableKey, revision: claim.revision, from: claim.status, to: next }
    } });
    return tx.knowledgeClaim.findUniqueOrThrow({ where: { id }, include: claimInclude });
  });
  return { claim: serializeClaim(updated) };
}

async function supersedeClaim(request: FastifyRequest) {
  const current = request.currentUser!;
  const { id } = z.object({ id: z.string() }).parse(request.params);
  const input = claimInput.parse({ ...(request.body as object), stableKey: existingStableKeyPlaceholder });
  const existing = await prisma.knowledgeClaim.findUniqueOrThrow({ where: { id } });
  if (existing.status !== "APPROVED") throw conflict("Only an approved claim can be superseded");
  assertRequiredTranslations(input.requiredLocales, input.translations);
  assertApplicability(input.applicability);
  await assertSourceVersions(input.sources.map((source) => source.documentVersionId));
  const created = await prisma.$transaction(async (tx) => {
    const revision = existing.revision + 1;
    const replacement = await tx.knowledgeClaim.create({ data: {
      stableKey: existing.stableKey, revision, claimType: input.claimType, usageScope: input.usageScope,
      requiredLocales: unique(input.requiredLocales), effectiveAt: input.effectiveAt, expiresAt: input.expiresAt,
      restrictions: input.restrictions || null, internalNotes: input.internalNotes || null,
      createdByUserId: current.user.id, lastEditedByUserId: current.user.id, supersedesClaimId: existing.id,
      translations: { create: input.translations.map((translation) => ({ locale: translation.locale, wording: translation.wording })) },
      sources: { create: sourceRows(input.sources) },
      brands: { create: unique(input.applicability.brandIds).map((brandId) => ({ brandId })) },
      products: { create: unique(input.applicability.productIds).map((productId) => ({ productId })) },
      packagingFormats: { create: unique(input.applicability.packagingFormatIds).map((packagingFormatId) => ({ packagingFormatId })) },
      markets: { create: unique(input.applicability.markets).map((value) => ({ value })) },
      audiences: { create: unique(input.applicability.audiences).map((value) => ({ value })) },
      objectives: { create: unique(input.applicability.objectives).map((value) => ({ value })) }
    } });
    await tx.auditEvent.create({ data:
      { actorUserId: current.user.id, action: "knowledge.claim_revision_created", entityType: "knowledge_claim", entityId: replacement.id, summary: "Replacement claim revision created", metadata: { stableKey: existing.stableKey, revision, supersedesClaimId: existing.id } }
    });
    return tx.knowledgeClaim.findUniqueOrThrow({ where: { id: replacement.id }, include: claimInclude });
  });
  return { claim: serializeClaim(created) };
}

function assertApprovalRequirements(claim: any) {
  if (!claim.sources.length || claim.sources.some((source: any) => source.documentVersion.reviewStatus !== "APPROVED_SOURCE")) {
    throw conflict("Every approved claim requires provenance from an approved source version");
  }
  const required = new Set((claim.requiredLocales as string[]).map((locale) => locale.toLowerCase()));
  for (const locale of required) {
    const translation = claim.translations.find((item: any) => item.locale.toLowerCase() === locale);
    if (!translation || translation.reviewStatus !== "APPROVED") throw conflict("Every required locale must be independently approved");
  }
  assertApplicability({
    brandIds: claim.brands, productIds: claim.products, packagingFormatIds: claim.packagingFormats,
    markets: claim.markets, audiences: claim.audiences, objectives: claim.objectives
  });
}

function assertNoSelfApproval(current: NonNullable<FastifyRequest["currentUser"]>, claim: any) {
  const ownerOverride = current.roles.includes("OWNER_ADMIN");
  if (!ownerOverride && (claim.createdByUserId === current.user.id || claim.lastEditedByUserId === current.user.id)) {
    throw Object.assign(new Error("Claim creators and editors cannot approve their own wording or claim"), { statusCode: 403 });
  }
}
function assertEditable(status: string) {
  if (!["DRAFT", "REJECTED"].includes(status)) throw conflict("Only draft or rejected claims may be edited");
}
function assertRequiredTranslations(required: string[], translations: Array<{ locale: string }>) {
  const present = new Set(translations.map((item) => item.locale.toLowerCase()));
  if (required.some((locale) => !present.has(locale.toLowerCase()))) throw badRequest("Wording is required for every required locale");
}
function assertApplicability(value: { brandIds: unknown[]; productIds: unknown[]; packagingFormatIds: unknown[]; markets: unknown[]; audiences: unknown[]; objectives: unknown[] }) {
  if (![value.brandIds, value.productIds, value.packagingFormatIds, value.markets, value.audiences, value.objectives].some((items) => items.length)) {
    throw badRequest("At least one explicit applicability value is required");
  }
}
async function assertSourceVersions(ids: string[]) {
  const versions = await prisma.knowledgeDocumentVersion.findMany({ where: { id: { in: unique(ids) } }, include: { document: true, fileObject: true } });
  if (versions.length !== unique(ids).length) throw badRequest("One or more source versions do not exist");
  if (versions.some((version) => version.document.lifecycleStatus !== "ACTIVE" || version.fileObject.securityStatus === "REJECTED")) {
    throw badRequest("Claims may only reference active, non-rejected source files");
  }
}
async function replaceApplicability(tx: any, claimId: string, value: z.infer<typeof applicabilitySchema>) {
  await Promise.all([
    tx.knowledgeClaimBrand.deleteMany({ where: { claimId } }), tx.knowledgeClaimProduct.deleteMany({ where: { claimId } }),
    tx.knowledgeClaimPackagingFormat.deleteMany({ where: { claimId } }), tx.knowledgeClaimMarket.deleteMany({ where: { claimId } }),
    tx.knowledgeClaimAudience.deleteMany({ where: { claimId } }), tx.knowledgeClaimObjective.deleteMany({ where: { claimId } })
  ]);
  await Promise.all([
    tx.knowledgeClaimBrand.createMany({ data: unique(value.brandIds).map((brandId) => ({ claimId, brandId })) }),
    tx.knowledgeClaimProduct.createMany({ data: unique(value.productIds).map((productId) => ({ claimId, productId })) }),
    tx.knowledgeClaimPackagingFormat.createMany({ data: unique(value.packagingFormatIds).map((packagingFormatId) => ({ claimId, packagingFormatId })) }),
    tx.knowledgeClaimMarket.createMany({ data: unique(value.markets).map((item) => ({ claimId, value: item })) }),
    tx.knowledgeClaimAudience.createMany({ data: unique(value.audiences).map((item) => ({ claimId, value: item })) }),
    tx.knowledgeClaimObjective.createMany({ data: unique(value.objectives).map((item) => ({ claimId, value: item })) })
  ]);
}
function sourceRows(sources: z.infer<typeof sourceInput>[]) {
  return sources.map((source) => ({
    documentVersionId: source.documentVersionId, pageNumber: source.pageNumber,
    sectionHeading: source.sectionHeading || null, tableFigureReference: source.tableFigureReference || null,
    sourceExcerpt: source.sourceExcerpt || null, sourceNotes: source.sourceNotes || null
  }));
}
function applicabilityAudit(value: z.infer<typeof applicabilitySchema>) {
  return {
    brandIds: unique(value.brandIds), productIds: unique(value.productIds), packagingFormatIds: unique(value.packagingFormatIds),
    markets: unique(value.markets), audiences: unique(value.audiences), objectives: unique(value.objectives)
  };
}
async function getClaim(id: string) {
  const claim = await prisma.knowledgeClaim.findUniqueOrThrow({ where: { id }, include: claimInclude });
  return { claim: serializeClaim(claim) };
}
function serializeClaim(claim: any) {
  return {
    ...claim,
    eligibleForFuturePublicUse: isFuturePublicEligible({
      status: claim.status,
      usageScope: claim.usageScope,
      effectiveAt: claim.effectiveAt,
      expiresAt: claim.expiresAt,
      superseded: claim.status === "SUPERSEDED"
    })
  };
}
function unique<T>(values: T[]) { return [...new Set(values)]; }
const existingStableKeyPlaceholder = "existing.claim.revision";
function conflict(message: string) { return Object.assign(new Error(message), { statusCode: 409 }); }
function badRequest(message: string) { return Object.assign(new Error(message), { statusCode: 400 }); }
