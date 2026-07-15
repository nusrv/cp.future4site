import { prisma } from "../db.js";
import { resolveApprovedKnowledge } from "./knowledgeResolver.js";

export class KnowledgeEvidenceError extends Error {
  constructor(public code: string, message: string, public statusCode = 422) {
    super(message);
  }
}

export async function buildContentEvidence(content: {
  id: string;
  brand: string;
  product: string | null;
  locale: string;
  market: string | null;
  audience: string | null;
  objective: string | null;
}) {
  const brands = await prisma.brand.findMany({
    where: { status: "active", OR: [{ key: content.brand }, { name: content.brand }] },
    select: { id: true },
    take: 2
  });
  if (brands.length !== 1) throw new KnowledgeEvidenceError("BRAND_CONTEXT_UNRESOLVED", "Select a verified Knowledge Library brand before evidence-backed generation");
  const products = content.product?.trim()
    ? await prisma.product.findMany({
      where: { status: "active", name: content.product.trim(), brandId: brands[0].id },
      select: { id: true },
      take: 2
    })
    : [];
  if (content.product?.trim() && products.length !== 1) {
    throw new KnowledgeEvidenceError("PRODUCT_CONTEXT_UNRESOLVED", "Select a verified product belonging to this brand before evidence-backed generation");
  }
  const resolution = await resolveApprovedKnowledge({
    locale: content.locale,
    brandId: brands[0].id,
    productId: products[0]?.id ?? null,
    packagingFormatId: null,
    market: content.market,
    audience: content.audience,
    objective: content.objective
  });
  if (resolution.diagnostics.truncated) {
    throw new KnowledgeEvidenceError("EVIDENCE_TRUNCATED", "The eligible claim set exceeds the resolver safety cap", 409);
  }
  if (resolution.diagnostics.conflicts.length) {
    throw new KnowledgeEvidenceError("EVIDENCE_CONFLICT", "Conflicting approved claim revisions must be resolved before generation", 409);
  }
  if (!resolution.claims.length) {
    throw new KnowledgeEvidenceError("EVIDENCE_MISSING", resolution.diagnostics.missingCoverage[0] ?? "No approved evidence matches this request");
  }
  const claims = resolution.claims.map((claim) => ({
    claim_id: claim.claimId,
    stable_key: claim.stableKey,
    revision: claim.revision,
    claim_type: claim.claimType,
    locale: claim.locale,
    approved_wording: claim.wording,
    applicability: claim.applicability,
    provenance: claim.provenance.map((source) => ({
      document_version_id: source.documentVersionId,
      document_title: source.documentTitle,
      version_number: source.versionNumber,
      page_number: source.pageNumber,
      section_heading: source.sectionHeading,
      table_figure_reference: source.tableFigureReference
    }))
  }));
  return {
    resolution,
    payload: {
      resolution_id: resolution.resolutionId,
      policy: "Use only the approved wording below for factual claims. Cite claim_id values in evidence_references. Do not invent, broaden, or combine claims.",
      claims
    }
  };
}

export function validateEvidenceReferences(output: Record<string, unknown>, allowedClaimIds: string[]) {
  const references = output.evidence_references;
  if (!Array.isArray(references) || !references.length) {
    throw new KnowledgeEvidenceError("EVIDENCE_REFERENCES_MISSING", "Generated copy did not cite an approved claim", 409);
  }
  const cited = references.map((reference) => {
    if (!reference || typeof reference !== "object" || Array.isArray(reference)) return "";
    return typeof (reference as Record<string, unknown>).claim_id === "string"
      ? String((reference as Record<string, unknown>).claim_id)
      : "";
  });
  if (cited.some((claimId) => !claimId || !allowedClaimIds.includes(claimId))) {
    throw new KnowledgeEvidenceError("EVIDENCE_REFERENCE_INVALID", "Generated copy cited evidence outside its approved snapshot", 409);
  }
  return [...new Set(cited)];
}

export function evidenceClaimIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((claim) => claim && typeof claim === "object" && !Array.isArray(claim) && typeof (claim as any).claim_id === "string"
    ? [String((claim as any).claim_id)]
    : []);
}
