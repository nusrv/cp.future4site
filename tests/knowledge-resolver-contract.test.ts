import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const resolver = read("src/server/services/knowledgeResolver.ts");
const route = read("src/server/routes/knowledgeResolver.ts");

describe("Phase 3 approved-claim resolver contract", () => {
  it("is read-only, permission-gated, and does not use legacy KnowledgeIndex", () => {
    expect(route).toContain('requirePermission("knowledge.resolve")');
    expect(route).toContain('app.post("/api/knowledge/resolve"');
    expect(resolver).toContain("knowledgeClaim.findMany");
    expect(resolver).not.toMatch(/knowledgeIndex/i);
    expect(resolver).not.toMatch(/knowledgeClaim\.(create|update|delete|upsert)/);
  });

  it("requires approved public-safe lifecycle and independently approved locale wording", () => {
    expect(resolver).toContain('where: { status: "APPROVED", usageScope: "PUBLIC_SAFE" }');
    expect(resolver).toContain('translation.reviewStatus !== "APPROVED"');
    expect(resolver).toContain("isFuturePublicEligible");
    expect(resolver).toContain("effectiveAt");
    expect(resolver).toContain("expiresAt");
  });

  it("keeps the current approved predecessor eligible while a replacement draft is pending", () => {
    expect(resolver).toContain("superseded: false");
    expect(resolver).not.toContain("Boolean(claim.supersededBy)");
    expect(resolver).not.toContain("supersededBy: { select:");
  });

  it("applies every exact applicability dimension before returning claims", () => {
    for (const field of ["brandIds", "productIds", "packagingFormatIds", "markets", "audiences", "objectives"]) {
      expect(resolver).toContain(field);
    }
    expect(resolver).toContain("matchesClaimApplicability(applicability, context)");
    expect(resolver).toContain("The selected brand does not match the selected product");
  });

  it("returns immutable claim IDs, localized wording, and safe provenance references", () => {
    for (const field of ["claimId", "stableKey", "revision", "wording", "documentVersionId", "versionNumber", "pageNumber", "sectionHeading", "tableFigureReference"]) {
      expect(resolver).toContain(field);
    }
    expect(resolver).not.toMatch(/storageKey|filePath|FILE_STORAGE_PATH|sourceExcerpt/);
  });

  it("reports missing coverage, conflicts, and exclusion counts without fallback broadening", () => {
    expect(resolver).toContain("missingCoverage");
    expect(resolver).toContain("conflicts");
    expect(resolver).toContain("applicabilityMismatch");
    expect(resolver).toContain("No eligible approved public-safe claims matched this exact context and locale");
    expect(resolver).not.toMatch(/semantic|embedding|vector|fuzzy/i);
  });

  it("does not read extraction, OCR, candidate, AI, n8n, prompt, or publishing domains", () => {
    expect(resolver).not.toMatch(/knowledgeDocumentExtraction|knowledgeOcr|knowledgeCandidate|gemini|openai|n8n|prompt|publish|contentRequest/i);
  });

  it("audits IDs and context but not approved wording", () => {
    expect(route).toContain('action: "knowledge.resolved"');
    expect(route).toContain("claimIds: result.claims.map");
    const metadata = route.slice(route.indexOf("metadata:"), route.indexOf("} }", route.indexOf("metadata:")));
    expect(metadata).not.toContain("wording");
  });
});
