import { describe, expect, it } from "vitest";
import { isFuturePublicEligible, matchesClaimApplicability } from "../src/shared/knowledgeClaims";

describe("approved claim future eligibility", () => {
  const base = { status: "APPROVED", usageScope: "PUBLIC_SAFE", superseded: false };

  it("requires approved, public-safe, effective, current, non-superseded claims", () => {
    const now = new Date("2026-07-13T12:00:00Z");
    expect(isFuturePublicEligible(base, now)).toBe(true);
    expect(isFuturePublicEligible({ ...base, status: "DRAFT" }, now)).toBe(false);
    expect(isFuturePublicEligible({ ...base, status: "REJECTED" }, now)).toBe(false);
    expect(isFuturePublicEligible({ ...base, status: "SUPERSEDED" }, now)).toBe(false);
    expect(isFuturePublicEligible({ ...base, status: "EXPIRED" }, now)).toBe(false);
    expect(isFuturePublicEligible({ ...base, usageScope: "INTERNAL_ONLY" }, now)).toBe(false);
    expect(isFuturePublicEligible({ ...base, usageScope: "RESTRICTED" }, now)).toBe(false);
    expect(isFuturePublicEligible({ ...base, effectiveAt: "2026-07-14T00:00:00Z" }, now)).toBe(false);
    expect(isFuturePublicEligible({ ...base, expiresAt: "2026-07-13T12:00:00Z" }, now)).toBe(false);
    expect(isFuturePublicEligible({ ...base, superseded: true }, now)).toBe(false);
  });

  it("never broadens product, packaging, or market restrictions", () => {
    const rule = { productIds: ["product-a"], packagingFormatIds: ["pack-5l"], markets: ["Jordan"] };
    expect(matchesClaimApplicability(rule, { productId: "product-a", packagingFormatId: "pack-5l", market: "jordan" })).toBe(true);
    expect(matchesClaimApplicability(rule, { productId: "product-b", packagingFormatId: "pack-5l", market: "Jordan" })).toBe(false);
    expect(matchesClaimApplicability(rule, { productId: "product-a", packagingFormatId: "pack-10l", market: "Jordan" })).toBe(false);
    expect(matchesClaimApplicability(rule, { productId: "product-a", packagingFormatId: "pack-5l", market: "UAE" })).toBe(false);
  });
});
