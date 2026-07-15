import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const routes = read("src/server/routes/knowledgeCandidates.ts");
const provider = read("src/server/services/knowledgeCandidates.ts");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/202607150003_knowledge_candidate_claims/migration.sql");
const ui = read("src/client/src/ui/KnowledgeLibrary.tsx");

describe("Phase 2C unapproved candidate claim contract", () => {
  it("requires feature, data-handling, credential, and permission gates", () => {
    const config = read("src/server/config.ts");
    expect(config).toContain('KNOWLEDGE_CANDIDATES_ENABLED: z.enum(["true", "false"]).default("false")');
    expect(config).toContain('KNOWLEDGE_CANDIDATE_DATA_APPROVED: z.enum(["true", "false"]).default("false")');
    expect(routes).toContain("!config.KNOWLEDGE_CANDIDATES_ENABLED || !config.KNOWLEDGE_CANDIDATE_DATA_APPROVED || !config.GEMINI_API_KEY");
    expect(routes).toContain('requirePermission("knowledge.candidate.generate")');
    expect(routes).toContain('requirePermission("knowledge.candidate.review")');
  });

  it("sends only selected fragments from active approved immutable sources", () => {
    expect(routes).toContain('reviewStatus !== "APPROVED_SOURCE"');
    expect(routes).toContain('lifecycleStatus !== "ACTIVE"');
    expect(routes).toContain('status !== "SUCCEEDED"');
    expect(routes).toContain("fragmentIds");
    expect(routes).toContain("INVALID_SOURCE_SELECTION");
    expect(provider).toContain("allowedIds");
    expect(provider).toContain("INVALID_PROVENANCE");
  });

  it("uses structured output, zero temperature, quotas, timeout, and strict parsing", () => {
    expect(provider).toContain('responseMimeType: "application/json"');
    expect(provider).toContain("responseSchema");
    expect(provider).toContain("temperature: 0");
    expect(provider).toContain("KNOWLEDGE_CANDIDATE_TIMEOUT_MS");
    expect(provider).toContain("KNOWLEDGE_CANDIDATE_MAX_INPUT_CHARS");
    expect(provider).toContain("providerOutputSchema.parse(JSON.parse(text))");
  });

  it("stores proposals separately with fragment-level provenance and decisions", () => {
    for (const model of ["KnowledgeCandidateRun", "KnowledgeCandidateClaim", "KnowledgeCandidateTranslation", "KnowledgeCandidateSource"]) {
      expect(schema).toContain("model " + model);
      expect(migration).toContain("CREATE TABLE " + model);
    }
    expect(schema).toContain("extractionFragmentId String?");
    expect(schema).toContain("ocrPageId String?");
    expect(schema).toContain("acceptedClaimId String? @unique");
  });

  it("never treats provider output as approval or direct generation knowledge", () => {
    expect(routes).not.toMatch(/status:\s*"APPROVED"/);
    expect(routes).not.toMatch(/reviewStatus:\s*"APPROVED"/);
    expect(routes).not.toMatch(/contentRequest\.(create|update)|automationJob\.(create|update)|publish/i);
    expect(provider).not.toMatch(/n8n|publish|contentRequest/i);
  });

  it("requires explicit operator confirmation, scope, applicability, and wording to create a draft", () => {
    expect(routes).toContain("confirmUnapprovedSuggestion: z.literal(true)");
    expect(routes).toContain("Explicit applicability is required before creating a claim draft");
    expect(routes).toContain("Every required locale needs operator-confirmed wording");
    expect(routes).toContain('status: "ACCEPTED"');
    expect(routes).toContain("knowledgeClaim.create");
    expect(routes).toContain("knowledge.candidate_accepted_as_draft");
    expect(ui).toContain("I verified the wording, provenance, usage scope, and applicability. Create a draft only.");
  });

  it("keeps candidate decisions transactional and immutable", () => {
    expect(routes).toContain("knowledgeCandidateClaim.updateMany");
    expect(routes).toContain('where: { id: candidateId, status: "PROPOSED", acceptedClaimId: null }');
    expect(routes).toContain("Candidate has already been decided");
    expect(routes).not.toMatch(/app\.patch\(["']\/api\/knowledge\/candidates/);
  });

  it("keeps the migration additive and legacy knowledge tables unchanged", () => {
    expect(migration).not.toMatch(/(?:DROP|ALTER|TRUNCATE|DELETE FROM)\s+(?:Document|KnowledgeIndex|KnowledgeDocument|KnowledgeDocumentVersion|KnowledgeClaim|FileObject)/i);
  });

  it("does not expose keys, prompts, full provider payloads, or storage identity", () => {
    const serializerSection = routes.slice(routes.indexOf("function serializeRun"));
    expect(serializerSection).not.toMatch(/inputHash|storageKey|sourceSha256|GEMINI_API_KEY/);
    expect(routes).not.toMatch(/metadata:\s*\{[^}]*prompt\s*:/);
    expect(routes).not.toMatch(/metadata:\s*\{[^}]*content\s*:/);
  });
});
