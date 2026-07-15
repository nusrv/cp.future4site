import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const content = read("src/server/routes/content.ts");
const automation = read("src/server/routes/automation.ts");
const automationService = read("src/server/services/automation.ts");
const evidence = read("src/server/services/knowledgeEvidence.ts");
const workflow = read("workflows/n8n/generated/01-content-request-intake-draft.json");
const migration = read("prisma/migrations/202607150004_generation_evidence_bundles/migration.sql");
const ui = read("src/client/src/ui/MarketingStudio.tsx");

describe("Phase 4 evidence-backed content generation contract", () => {
  it("preserves existing generation behavior behind a disabled-by-default flag", () => {
    expect(read("src/server/config.ts")).toContain('KNOWLEDGE_GENERATION_ENABLED: z.enum(["true", "false"]).default("false")');
    expect(content).toContain("config.KNOWLEDGE_GENERATION_ENABLED ? await buildContentEvidence(content) : null");
    expect(content).toContain("...(evidence ? { knowledge_evidence: evidence.payload } : {})");
  });

  it("fails closed on unresolved brand/product, missing coverage, conflicts, or truncation", () => {
    for (const code of ["BRAND_CONTEXT_UNRESOLVED", "PRODUCT_CONTEXT_UNRESOLVED", "EVIDENCE_MISSING", "EVIDENCE_CONFLICT", "EVIDENCE_TRUNCATED"]) {
      expect(evidence).toContain(code);
    }
    expect(evidence).toContain("resolveApprovedKnowledge");
    expect(evidence).toContain("brandId: brands[0].id");
    expect(evidence).toContain("productId: products[0]?.id ?? null");
    expect(evidence).toContain("packagingFormatId: null");
  });

  it("snapshots exact approved claims and provenance before dispatch", () => {
    expect(content).toContain("knowledgeEvidenceBundle.create");
    expect(content).toContain("knowledgeEvidenceBundle.update");
    expect(content.indexOf("knowledgeEvidenceBundle.create")).toBeLessThan(content.indexOf("dispatchJob(job.id)"));
    for (const field of ["claim_id", "stable_key", "revision", "approved_wording", "document_version_id", "resolution_id"]) {
      expect(evidence).toContain(field);
    }
  });

  it("sends evidence through signed job payloads without n8n database access", () => {
    expect(content).toContain("knowledge_evidence: evidence.payload");
    expect(read("src/server/services/automation.ts")).toContain("payload: job.inputPayload");
    expect(workflow).toContain("payload.knowledge_evidence");
    expect(workflow).toContain("claim_id");
    expect(workflow).not.toMatch(/mysql|mariadb|prisma|database_url/i);
  });

  it("requires callback claim-ID citations from the exact snapshot", () => {
    expect(automation).toContain("validateEvidenceReferences(input.outputs ?? {}, evidenceClaimIds(evidenceBundle.claims))");
    expect(automation).toContain('eventType: "evidence_validation_failed"');
    expect(automation).toContain('currentStatus: "FAILED"');
    expect(evidence).toContain("EVIDENCE_REFERENCES_MISSING");
    expect(evidence).toContain("EVIDENCE_REFERENCE_INVALID");
    expect(automationService).toContain("claim_id");
  });

  it("keeps evidence-backed request history immutable and operator-visible", () => {
    expect(content).toContain("Evidence-backed content requests remain auditable and cannot be permanently deleted");
    expect(content).toContain('app.get("/api/content/requests/:id/evidence"');
    expect(ui).toContain("function EvidencePanel");
    expect(ui).toContain("Approved knowledge evidence");
  });

  it("requires an explicit content locale and preserves independent wording", () => {
    expect(read("src/shared/contracts.ts")).toContain('locale: z.enum(["en", "ar"]).default("en")');
    expect(content).toContain("locale: input.locale");
    expect(ui).toContain('name="locale"');
    expect(workflow).toContain('requestedLocale');
  });

  it("uses an additive migration with a safe default for existing requests", () => {
    expect(migration).toContain("ALTER TABLE ContentRequest ADD COLUMN locale VARCHAR(191) NOT NULL DEFAULT 'en'");
    expect(migration).toContain("CREATE TABLE KnowledgeEvidenceBundle");
    expect(migration).not.toMatch(/DROP|TRUNCATE|DELETE FROM/i);
    expect(migration).not.toMatch(/ALTER TABLE (Document|KnowledgeIndex|KnowledgeDocument|KnowledgeClaim|FileObject)/i);
  });

  it("does not auto-approve claims, copy, creatives, or publishing", () => {
    const combined = content + automation + evidence;
    expect(combined).not.toMatch(/knowledgeClaim\.update[\s\S]{0,200}status:\s*"APPROVED"/);
    expect(combined).not.toMatch(/approvalStatus:\s*"approved"[\s\S]{0,100}knowledgeEvidence/i);
    expect(evidence).not.toMatch(/publishingRecord|publish_/i);
  });
});
