export type ClaimEligibility = {
  status: string;
  usageScope: string;
  effectiveAt?: Date | string | null;
  expiresAt?: Date | string | null;
  superseded: boolean;
};

export type ClaimApplicability = {
  productIds: string[];
  packagingFormatIds: string[];
  markets: string[];
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
  context: { productId?: string | null; packagingFormatId?: string | null; market?: string | null }
) {
  if (applicability.productIds.length && (!context.productId || !applicability.productIds.includes(context.productId))) return false;
  if (applicability.packagingFormatIds.length && (!context.packagingFormatId || !applicability.packagingFormatIds.includes(context.packagingFormatId))) return false;
  if (applicability.markets.length && (!context.market || !applicability.markets.some((market) => market.toLowerCase() === context.market!.toLowerCase()))) return false;
  return true;
}
