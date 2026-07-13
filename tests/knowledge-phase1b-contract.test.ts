import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const sourceRoutes = read("src/server/routes/knowledge.ts");
const claimRoutes = read("src/server/routes/knowledgeClaims.ts");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/202607130002_human_review_approved_claims/migration.sql");
const supersessionMigration = read("prisma/migrations/202607130003_claim_supersession_guard/migration.sql");

describe("Phase 1B human review and approved claims contract", () => {
  it("guards source review transitions and preserves approved predecessors", () => {
    for (const permission of ["knowledge.review", "knowledge.approve"]) expect(sourceRoutes).toContain(`requirePermission("${permission}")`);
    expect(sourceRoutes).toContain('previous.reviewStatus === "APPROVED_SOURCE" ? "APPROVED_SOURCE" : "SUPERSEDED"');
    expect(sourceRoutes).toContain('existing.document.lifecycleStatus !== "ACTIVE"');
    expect(sourceRoutes).toContain('existing.fileObject.securityStatus === "REJECTED"');
    expect(sourceRoutes).toContain("A rejection reason is required");
    expect(sourceRoutes).not.toContain("knowledgeClaim.create");
  });

  it("prevents generic patches from assigning lifecycle or approval state", () => {
    expect(claimRoutes).toContain(".strict().parse(request.body)");
    expect(claimRoutes).not.toMatch(/app\.patch[\s\S]{0,1000}status:\s*input\.status/);
    expect(claimRoutes).toContain("assertEditable(existing)");
    expect(claimRoutes).toContain('claim.status !== "DRAFT" || claim.supersededBy');
  });

  it("requires approved provenance, independent locales, explicit applicability, and separation of duties", () => {
    expect(claimRoutes).toContain('source.documentVersion.reviewStatus === "APPROVED_SOURCE"');
    expect(claimRoutes).toContain('translation.reviewStatus !== "APPROVED"');
    expect(claimRoutes).toContain("At least one explicit applicability value is required");
    expect(claimRoutes).toContain("Claim creators and editors cannot approve their own wording or claim");
    expect(claimRoutes).toContain('current.roles.includes("OWNER_ADMIN")');
  });

  it("keeps KnowledgeIndex, generation, n8n, and publishing outside the new domain", () => {
    expect(schema).toContain("model KnowledgeIndex");
    expect(migration).not.toMatch(/ALTER TABLE KnowledgeIndex|DROP TABLE KnowledgeIndex/);
    expect(supersessionMigration).not.toMatch(/KnowledgeIndex|Document|FileObject/);
    expect(claimRoutes).not.toMatch(/n8n|gemini|automationJob|publishing|contentRequest/i);
    expect(sourceRoutes).not.toMatch(/ocr|extract|embedding|semantic/i);
  });

  it("keeps immutable claim revisions and locale uniqueness", () => {
    expect(schema).toContain('@@unique([stableKey, revision], map: "KnowledgeClaim_stableKey_revision_key")');
    expect(schema).toContain("@@unique([claimId, locale])");
    expect(claimRoutes).toContain('where: { id: approvedPredecessor.id }');
    expect(claimRoutes).toContain('data: { status: "SUPERSEDED" }');
    expect(claimRoutes).toContain("supersedesClaimId: existing.id");
    expect(claimRoutes).toContain("replacesApprovedClaimId: approvedPredecessor?.id ?? null");
    expect(claimRoutes).toContain("FOR UPDATE");
    expect(claimRoutes).not.toContain("knowledgeClaim.delete");
  });
});
