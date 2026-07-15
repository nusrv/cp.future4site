import { prisma } from "../db.js";
import { sha256 } from "../security/crypto.js";
import { isFuturePublicEligible, matchesClaimApplicability } from "../../shared/knowledgeClaims.js";

export type KnowledgeResolverContext = {
  locale: string;
  brandId?: string | null;
  productId?: string | null;
  packagingFormatId?: string | null;
  market?: string | null;
  audience?: string | null;
  objective?: string | null;
  at?: Date;
};

export type ResolvedKnowledgeClaim = {
  claimId: string;
  stableKey: string;
  revision: number;
  claimType: string;
  locale: string;
  wording: string;
  effectiveAt: Date | null;
  expiresAt: Date | null;
  applicability: {
    brandIds: string[];
    productIds: string[];
    packagingFormatIds: string[];
    markets: string[];
    audiences: string[];
    objectives: string[];
  };
  provenance: Array<{
    documentId: string;
    documentTitle: string;
    documentVersionId: string;
    versionNumber: number;
    pageNumber: number | null;
    sectionHeading: string | null;
    tableFigureReference: string | null;
  }>;
};

export async function resolveApprovedKnowledge(input: KnowledgeResolverContext) {
  const at = input.at ?? new Date();
  const locale = input.locale.trim().toLowerCase();
  const product = input.productId
    ? await prisma.product.findUnique({ where: { id: input.productId }, select: { id: true, brandId: true, status: true } })
    : null;
  if (input.productId && (!product || product.status !== "active")) {
    return emptyResolution(input, at, "The selected product is unavailable");
  }
  if (input.brandId && product?.brandId && input.brandId !== product.brandId) {
    return emptyResolution(input, at, "The selected brand does not match the selected product");
  }
  const context = { ...input, brandId: input.brandId ?? product?.brandId ?? null };
  const claims = await prisma.knowledgeClaim.findMany({
    where: { status: "APPROVED", usageScope: "PUBLIC_SAFE" },
    include: {
      translations: { where: { locale }, orderBy: { locale: "asc" } },
      sources: {
        include: {
          documentVersion: {
            include: { document: { select: { id: true, title: true } } }
          }
        },
        orderBy: { createdAt: "asc" }
      },
      brands: true,
      products: true,
      packagingFormats: true,
      markets: true,
      audiences: true,
      objectives: true,
    },
    orderBy: [{ stableKey: "asc" }, { revision: "desc" }],
    take: 1001
  });
  const truncated = claims.length > 1000;
  const excluded = {
    outsideEffectiveWindow: 0,
    superseded: 0,
    localeUnavailable: 0,
    localeUnapproved: 0,
    applicabilityMismatch: 0,
    provenanceUnavailable: 0
  };
  const resolved: ResolvedKnowledgeClaim[] = [];
  for (const claim of claims.slice(0, 1000)) {
    if (!isFuturePublicEligible({
      status: claim.status,
      usageScope: claim.usageScope,
      effectiveAt: claim.effectiveAt,
      expiresAt: claim.expiresAt,
      superseded: false
    }, at)) {
      excluded.outsideEffectiveWindow += 1;
      continue;
    }
    const translation = claim.translations[0];
    if (!translation) {
      excluded.localeUnavailable += 1;
      continue;
    }
    if (translation.reviewStatus !== "APPROVED") {
      excluded.localeUnapproved += 1;
      continue;
    }
    const applicability = {
      brandIds: claim.brands.map((row) => row.brandId),
      productIds: claim.products.map((row) => row.productId),
      packagingFormatIds: claim.packagingFormats.map((row) => row.packagingFormatId),
      markets: claim.markets.map((row) => row.value),
      audiences: claim.audiences.map((row) => row.value),
      objectives: claim.objectives.map((row) => row.value)
    };
    if (!matchesClaimApplicability(applicability, context)) {
      excluded.applicabilityMismatch += 1;
      continue;
    }
    const approvedSources = claim.sources.filter((source) => source.documentVersion.reviewStatus === "APPROVED_SOURCE");
    if (!approvedSources.length) {
      excluded.provenanceUnavailable += 1;
      continue;
    }
    resolved.push({
      claimId: claim.id,
      stableKey: claim.stableKey,
      revision: claim.revision,
      claimType: claim.claimType,
      locale: translation.locale,
      wording: translation.wording,
      effectiveAt: claim.effectiveAt,
      expiresAt: claim.expiresAt,
      applicability,
      provenance: approvedSources.map((source) => ({
        documentId: source.documentVersion.document.id,
        documentTitle: source.documentVersion.document.title,
        documentVersionId: source.documentVersion.id,
        versionNumber: source.documentVersion.versionNumber,
        pageNumber: source.pageNumber,
        sectionHeading: source.sectionHeading,
        tableFigureReference: source.tableFigureReference
      }))
    });
  }
  const stableKeyCounts = new Map<string, number>();
  for (const claim of resolved) stableKeyCounts.set(claim.stableKey, (stableKeyCounts.get(claim.stableKey) ?? 0) + 1);
  const conflicts = [...stableKeyCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([stableKey]) => ({ stableKey, reason: "Multiple active approved revisions matched the same conceptual claim" }));
  const contextSnapshot = {
    locale,
    brandId: context.brandId ?? null,
    productId: context.productId ?? null,
    packagingFormatId: context.packagingFormatId ?? null,
    market: context.market ?? null,
    audience: context.audience ?? null,
    objective: context.objective ?? null,
    at: at.toISOString()
  };
  return {
    resolutionId: sha256(Buffer.from(JSON.stringify({ context: contextSnapshot, claimIds: resolved.map((claim) => claim.claimId) }), "utf8")),
    resolvedAt: new Date(),
    context: contextSnapshot,
    claims: resolved,
    diagnostics: {
      missingCoverage: resolved.length ? [] : ["No eligible approved public-safe claims matched this exact context and locale"],
      conflicts,
      truncated,
      excluded
    }
  };
}

function emptyResolution(input: KnowledgeResolverContext, at: Date, reason: string) {
  const context = {
    locale: input.locale.trim().toLowerCase(),
    brandId: input.brandId ?? null,
    productId: input.productId ?? null,
    packagingFormatId: input.packagingFormatId ?? null,
    market: input.market ?? null,
    audience: input.audience ?? null,
    objective: input.objective ?? null,
    at: at.toISOString()
  };
  return {
    resolutionId: sha256(Buffer.from(JSON.stringify({ context, claimIds: [] }), "utf8")),
    resolvedAt: new Date(),
    context,
    claims: [] as ResolvedKnowledgeClaim[],
    diagnostics: {
      missingCoverage: [reason],
      conflicts: [] as Array<{ stableKey: string; reason: string }>,
      truncated: false,
      excluded: {
        outsideEffectiveWindow: 0,
        superseded: 0,
        localeUnavailable: 0,
        localeUnapproved: 0,
        applicabilityMismatch: 0,
        provenanceUnavailable: 0
      }
    }
  };
}
