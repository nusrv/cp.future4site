import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const routes = read("src/server/routes/knowledgeOcr.ts");
const service = read("src/server/services/knowledgeOcr.ts");
const sourceRoutes = read("src/server/routes/knowledge.ts");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/202607150002_knowledge_ocr/migration.sql");
const ui = read("src/client/src/ui/KnowledgeLibrary.tsx");

describe("Phase 2B explicit OCR contract", () => {
  it("is disabled by default, explicitly requested, and permission-gated", () => {
    expect(read("src/server/config.ts")).toContain('KNOWLEDGE_OCR_ENABLED: z.enum(["true", "false"]).default("false")');
    expect(routes).toContain('requirePermission("knowledge.ocr")');
    expect(routes).toContain("if (!config.KNOWLEDGE_OCR_ENABLED)");
    expect(routes).toContain('z.enum(["eng", "ara", "eng+ara"])');
  });

  it("binds jobs and pages to an immutable source version", () => {
    expect(schema).toMatch(/model KnowledgeOcrJob[\s\S]*documentVersionId\s+String[\s\S]*sourceSha256\s+String/);
    expect(schema).toMatch(/model KnowledgeOcrPage[\s\S]*pageNumber\s+Int[\s\S]*confidence\s+Float\?/);
    expect(routes).toContain("sourceSha256: version.fileObject.sha256Hash");
    expect(routes).not.toMatch(/sourceSha256:\s*job\.sourceSha256/);
    expect(routes).not.toMatch(/storageKey:\s*job/);
  });

  it("uses bounded non-shell processes, safe temporary paths, and cleanup", () => {
    expect(service).toContain("shell: false");
    expect(service).toContain("KNOWLEDGE_OCR_TIMEOUT_MS");
    expect(service).toContain("KNOWLEDGE_OCR_MAX_PAGES");
    expect(service).toContain("KNOWLEDGE_OCR_MAX_CHARS");
    expect(service).toContain("KNOWLEDGE_OCR_MAX_RASTER_BYTES");
    expect(service).toContain('mkdtemp(join(tmpdir(), "ff-ocr-"))');
    expect(service).toContain("rm(directory, { recursive: true, force: true })");
    expect(service).not.toMatch(/exec\s*\(/);
  });

  it("rejects concurrent work and recovers interrupted active jobs", () => {
    expect(schema).toContain("activeKey String? @unique");
    expect(routes).toContain("OCR is already running for this source version");
    expect(routes).toContain("STALE_JOB_RECOVERED");
    expect(routes).toContain("activeKey: null");
  });

  it("records language, version, confidence, duration, and low-confidence pages", () => {
    for (const value of ["engineVersion", "languages", "averageConfidence", "durationMs", "lowConfidence"]) {
      expect(routes + service + schema).toContain(value);
    }
    expect(service).toContain("KNOWLEDGE_OCR_LOW_CONFIDENCE");
  });

  it("supports authenticated source comparison without exposing storage", () => {
    expect(sourceRoutes).toContain('z.enum(["attachment", "inline"]).default("attachment")');
    expect(sourceRoutes).toContain('"knowledge.file_viewed"');
    expect(ui).toContain("?disposition=inline");
    expect(ui).toContain("Review OCR text");
    expect(ui).toContain("lowConfidence");
  });

  it("keeps OCR isolated from claims, AI, n8n, generation, and publishing", () => {
    const combined = routes + service + migration;
    expect(combined).not.toMatch(/knowledgeClaim\.(create|update|delete)/);
    expect(combined).not.toMatch(/gemini|openai|anthropic|n8n|embedding|vector|publish|contentRequest/i);
  });

  it("uses an additive migration that does not touch legacy tables", () => {
    expect(migration).toContain("CREATE TABLE KnowledgeOcrJob");
    expect(migration).toContain("CREATE TABLE KnowledgeOcrPage");
    expect(migration).not.toMatch(/(?:DROP|ALTER|TRUNCATE|DELETE FROM)\s+(?:Document|KnowledgeIndex|KnowledgeDocument|KnowledgeDocumentVersion|FileObject)/i);
  });
});
