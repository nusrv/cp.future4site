import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const routes = read("src/server/routes/knowledgeClaims.ts");
const ui = read("src/client/src/ui/KnowledgeLibrary.tsx");
const css = read("src/client/src/styles.css");
const permissions = read("src/shared/permissions.ts");
const schema = read("prisma/schema.prisma");
const migration1 = read("prisma/migrations/202607130002_human_review_approved_claims/migration.sql");
const migration2 = read("prisma/migrations/202607130003_claim_supersession_guard/migration.sql");
const server = read("src/server/index.ts");

describe("Phase 1B claim revision and supersession contract", () => {
  it("returns deterministic history and identifies latest and current approved revisions", () => {
    expect(routes).toContain('app.get("/api/knowledge/claims/:id/revisions"');
    expect(routes).toContain('orderBy: { revision: "desc" }');
    expect(routes).toContain("latestRevisionId");
    expect(routes).toContain("currentApprovedRevisionId");
    expect(routes).toContain("isHistorical");
    expect(routes).toContain("isEditable");
  });

  it("creates a draft without changing the approved predecessor", () => {
    const supersedeBody = routes.slice(routes.indexOf("async function supersedeClaim"), routes.indexOf("function assertApprovalRequirements"));
    expect(supersedeBody).toContain("replacesApprovedClaimId: approvedPredecessor?.id ?? null");
    expect(supersedeBody).not.toContain('data: { status: "SUPERSEDED" }');
    expect(supersedeBody).toContain("A newer revision already exists");
    expect(supersedeBody).toContain("latest.revision + 1");
  });

  it("locks the conceptual claim and atomically swaps exactly one approved revision", () => {
    expect(routes).toContain("lockClaimRevisionSet");
    expect(routes).toContain("ORDER BY revision FOR UPDATE");
    expect(routes).toContain('activeApproved.length > 1');
    expect(routes).toContain('claim.replacesApprovedClaimId !== approvedPredecessor.id');
    expect(routes).toContain('action: "knowledge.claim_superseded"');
    expect(routes).toContain('action: next === "UNDER_REVIEW" ? "knowledge.claim_review_submitted" : next === "APPROVED" ? "knowledge.claim_approved"');
  });

  it("keeps approved, rejected, expired, superseded, and historical rows immutable", () => {
    expect(routes).toContain('claim.status !== "DRAFT" || claim.supersededBy');
    expect(routes).toContain("Only the latest draft revision may be edited");
    expect(routes).toContain("Historical revisions cannot change review state");
    expect(routes).toContain("Historical or decided claim translations cannot change review state");
    expect(ui).toContain("Historical revisions are read-only.");
    expect(ui).toContain("Rejected wording remains immutable.");
  });

  it("keeps generic patches strict and excludes protected workflow fields", () => {
    expect(routes).toContain("}).strict().parse(request.body)");
    for (const protectedField of ["status", "reviewStatus", "reviewedByUserId", "approvedByUserId", "approvedAt", "supersedesClaimId", "replacesApprovedClaimId"]) {
      expect(routes).not.toContain(protectedField + ": input." + protectedField);
    }
    expect(routes).not.toContain('status: existing.status === "REJECTED"');
    expect(routes).toContain('update: { wording: input.wording }');
    expect(routes).toContain("Reviewed wording is immutable. Create a new claim revision to change it.");
  });

  it("corrects rejected claims through a new draft without mutating the rejected row", () => {
    expect(routes).toContain('existing.status === "APPROVED" && approvedPredecessor?.id !== existing.id');
    expect(routes).toContain("approvedPredecessor = activeApproved[0] ?? null");
    expect(ui).toContain("The rejected revision remains immutable while the new draft starts a separate review.");
  });

  it("preserves locale independence and approval requirements", () => {
    expect(schema).toContain("@@unique([claimId, locale])");
    expect(routes).toContain("where: { claimId_locale: { claimId, locale: input.locale } }");
    expect(routes).toContain('existingTranslation.reviewStatus !== "DRAFT"');
    /*
    expect(routes).toContain("reviewStatus: \PROPOSED\");
    */
    expect(ui).toContain("Only wording still in DRAFT can be edited. Reviewed locales remain locked.");
    expect(routes).toContain("Every required locale must be independently approved");
    expect(routes).toContain('requirePermission("knowledge.claim.approve")');
  });

  it("preserves provenance and applicability per revision without exposing storage identity", () => {
    for (const field of ["pageNumber", "sectionHeading", "tableFigureReference", "sourceExcerpt", "sourceNotes"]) expect(routes).toContain(field);
    for (const field of ["brands", "products", "packagingFormats", "markets", "audiences", "objectives"]) expect(routes).toContain(field);
    expect(routes).toContain("downloadUrl");
    expect(routes).not.toMatch(/storageKey|filesystemPath|absolutePath/);
    expect(ui).toContain("Open source document");
    expect(ui).toContain("Download source version");
  });

  it("keeps role actions aligned with the documented separation of duties", () => {
    expect(permissions).toContain('"knowledge.claim.create"');
    expect(permissions).toContain('"knowledge.claim.edit"');
    expect(permissions).toContain('"knowledge.claim.review"');
    expect(permissions).toContain('"knowledge.claim.approve"');
    expect(routes).toContain('current.roles.includes("OWNER_ADMIN")');
    expect(routes).toContain("Claim creators and editors cannot approve their own wording or claim");
    expect(permissions).toMatch(/MARKETING:[\s\S]*"knowledge\.claim\.create"[\s\S]*"knowledge\.claim\.edit"/);
    expect(permissions).toMatch(/CONTENT_REVIEWER:[\s\S]*"knowledge\.claim\.review"[\s\S]*"knowledge\.claim\.approve"/);
  });

  it("maps authentication, authorization, missing records, conflicts, and incomplete approvals safely", () => {
    expect(server).toContain('reply.code(404).send({ error: "Requested record was not found"');
    expect(server).toContain('reply.code(409).send({ error: "A conflicting record already exists"');
    expect(routes).toContain("statusCode: 403");
    expect(routes).toContain("statusCode: 409");
    expect(routes).toContain("statusCode: 422");
    expect(ui).toContain("Your session has expired");
    expect(ui).toContain("Approval requirements are incomplete");
  });

  it("requires active source documents for new or edited provenance while preserving historical links", () => {
    expect(routes).toContain('version.document.lifecycleStatus !== "ACTIVE"');
    expect(routes).toContain('version.fileObject.securityStatus === "REJECTED"');
    expect(routes).toContain("At least one approved source version is required before claim approval");
    expect(schema).toContain("documentVersion KnowledgeDocumentVersion @relation");
    expect(schema).toContain("onDelete: Restrict");
  });

  it("provides complete responsive history and in-app supersession controls", () => {
    for (const copy of ["Current approved", "Historical revision", "Create draft revision", "Revision activity", "Localized wording review", "Source provenance"]) expect(ui).toContain(copy);
    expect(ui).toContain("claim-history-workspace");
    expect(ui).not.toContain("window.confirm");
    expect(css).toContain("@media (max-width: 700px)");
    expect(css).toContain(".claim-history-workspace { display: block; }");
  });

  it("keeps migrations additive and legacy domains untouched", () => {
    expect(migration1).not.toMatch(/DROP TABLE|ALTER TABLE (Document|KnowledgeIndex|FileObject)/);
    expect(migration2).toContain("ADD COLUMN replacesApprovedClaimId");
    expect(migration2).not.toMatch(/DROP|KnowledgeIndex|FileObject/);
    expect(schema).toContain("@@index([replacesApprovedClaimId, status])");
  });

  it("keeps Phase 1B isolated from generation and publishing", () => {
    expect(routes).not.toMatch(/gemini|n8n|ocr|extract|embedding|semantic|publishing|contentRequest|automationJob/i);
    expect(ui).toContain("Claims remain disconnected from AI generation.");
  });
});
