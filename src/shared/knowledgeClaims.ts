export type ClaimEligibility = {
  status: string;
  usageScope: string;
  effectiveAt?: Date | string | null;
  expiresAt?: Date | string | null;
  superseded: boolean;
};

export type ClaimApplicability = {
  brandIds?: string[];
  productIds: string[];
  packagingFormatIds: string[];
  markets: string[];
  audiences?: string[];
  objectives?: string[];
};

export function isFuturePublicEligible(claim: ClaimEligibility, now = new Date()) {
  return claim.status === "APPROVED" &&
    claim.usageScope === "PUBLIC_SAFE" &&
    !claim.superseded &&
    (!claim.effectiveAt || new Date(claim.effectiveAt) <= now) &&
    (!claim.expiresAt || new Date(claim.expiresAt) > now);
}

export function matchesClaimApplicability(
  applicability: ClaimApplicability,
  context: {
    brandId?: string | null;
    productId?: string | null;
    packagingFormatId?: string | null;
    market?: string | null;
    audience?: string | null;
    objective?: string | null;
  }
) {
  if (applicability.brandIds?.length && (!context.brandId || !applicability.brandIds.includes(context.brandId))) return false;
  if (applicability.productIds.length && (!context.productId || !applicability.productIds.includes(context.productId))) return false;
  if (applicability.packagingFormatIds.length && (!context.packagingFormatId || !applicability.packagingFormatIds.includes(context.packagingFormatId))) return false;
  if (applicability.markets.length && (!context.market || !applicability.markets.some((market) => market.toLowerCase() === context.market!.toLowerCase()))) return false;
  if (applicability.audiences?.length && (!context.audience || !applicability.audiences.some((audience) => audience.toLowerCase() === context.audience!.toLowerCase()))) return false;
  if (applicability.objectives?.length && (!context.objective || !applicability.objectives.some((objective) => objective.toLowerCase() === context.objective!.toLowerCase()))) return false;
  return true;
}
