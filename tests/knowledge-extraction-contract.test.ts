import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const routes = read("src/server/routes/knowledgeExtraction.ts");
const service = read("src/server/services/knowledgeExtraction.ts");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/202607150001_deterministic_knowledge_extraction/migration.sql");
const ui = read("src/client/src/ui/KnowledgeLibrary.tsx");

describe("Phase 2A deterministic extraction contract", () => {
  it("is disabled by default and permission-gated", () => {
    expect(read("src/server/config.ts")).toContain('KNOWLEDGE_EXTRACTION_ENABLED: z.enum(["true", "false"]).default("false")');
    expect(routes).toContain('requirePermission("knowledge.extract")');
    expect(routes).toContain("if (!config.KNOWLEDGE_EXTRACTION_ENABLED)");
    expect(read("src/shared/permissions.ts")).toContain('"knowledge.extract"');
  });

  it("binds every extraction to one immutable source version and checksum", () => {
    expect(schema).toMatch(/model KnowledgeDocumentExtraction[\s\S]*documentVersionId\s+String[\s\S]*sourceSha256\s+String/);
    expect(routes).toContain("sourceSha256: version.fileObject.sha256Hash");
    expect(routes).toContain("documentVersionId: version.id");
    expect(routes).not.toMatch(/sourceSha256:\s*extraction\.sourceSha256/);
    expect(routes).not.toMatch(/storageKey:\s*extraction/);
  });

  it("uses bounded, non-shell PDF execution and built-in TXT/CSV decoding", () => {
    expect(service).toContain('normalizedExtension === "txt" || normalizedExtension === "csv"');
    expect(service).toContain('normalizedExtension === "pdf"');
    expect(service).toContain('shell: false');
    expect(service).toContain("KNOWLEDGE_EXTRACTION_TIMEOUT_MS");
    expect(service).toContain("KNOWLEDGE_EXTRACTION_MAX_CHARS");
    expect(service).toContain('new TextDecoder("utf-8", { fatal: true })');
    expect(service).not.toMatch(/exec\s*\(/);
  });

  it("retains page-aware fragments without mutating files or approved claims", () => {
    expect(schema).toMatch(/model KnowledgeExtractionFragment[\s\S]*pageNumber\s+Int\?[\s\S]*content\s+String\s+@db\.LongText/);
    expect(routes).toContain("knowledgeExtractionFragment.createMany");
    expect(routes).not.toMatch(/knowledgeClaim\.(create|update|delete)/);
    expect(routes).not.toMatch(/fileObject\.(update|delete)/);
  });

  it("keeps the migration additive and away from legacy knowledge tables", () => {
    expect(migration).toContain("CREATE TABLE KnowledgeDocumentExtraction");
    expect(migration).toContain("CREATE TABLE KnowledgeExtractionFragment");
    expect(migration).not.toMatch(/(?:DROP|ALTER|TRUNCATE|DELETE FROM)\s+(?:Document|KnowledgeIndex|KnowledgeDocument|KnowledgeDocumentVersion|FileObject)/i);
  });

  it("does not introduce AI, OCR, n8n, embedding, or publishing coupling", () => {
    const combined = routes + service + migration;
    expect(combined).not.toMatch(/gemini|openai|anthropic|n8n|ocr|embedding|vector|publish/i);
  });

  it("shows per-version status and safe unavailability reasons in CP", () => {
    expect(ui).toContain('permissions.includes("knowledge.extract")');
    expect(ui).toContain("function VersionExtraction");
    expect(ui).toContain("Restore this document before extracting text.");
    expect(ui).toContain("Security-rejected files cannot be extracted.");
    expect(ui).toContain("Deterministic extraction supports TXT, CSV, and PDF files.");
  });
});
