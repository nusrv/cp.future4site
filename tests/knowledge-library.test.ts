import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const routes = read("src/server/routes/knowledge.ts");
const app = read("src/client/src/ui/App.tsx");
const ui = read("src/client/src/ui/KnowledgeLibrary.tsx");
const css = read("src/client/src/styles.css");
const migration = read("prisma/migrations/202607130001_private_knowledge_library/migration.sql");

describe("private Knowledge Library contract", () => {
  it("registers only authenticated, permission-guarded Phase 1A routes", () => {
    expect(read("src/server/index.ts")).toContain("knowledgeRoutes(app)");
    for (const permission of ["knowledge.read", "knowledge.upload", "knowledge.edit", "knowledge.archive"]) {
      expect(routes).toContain("requirePermission(" + JSON.stringify(permission) + ")");
    }
    expect(routes).toContain("app.get(" + JSON.stringify("/api/knowledge/documents"));
    expect(routes).toContain("app.post(" + JSON.stringify("/api/knowledge/documents"));
    expect(routes).toContain("app.get(" + JSON.stringify("/api/knowledge/documents/:id"));
    expect(routes).toContain("app.patch(" + JSON.stringify("/api/knowledge/documents/:id"));
    expect(routes).toContain("app.post(" + JSON.stringify("/api/knowledge/documents/:id/versions"));
    expect(routes).toContain("app.get(" + JSON.stringify("/api/knowledge/documents/:id/versions/:versionId/file"));
    expect(routes).toContain("app.post(" + JSON.stringify("/api/knowledge/documents/:id/archive"));
    expect(routes).toContain("app.post(" + JSON.stringify("/api/knowledge/documents/:id/restore"));
    expect(routes).not.toMatch(/knowledge\/documents.*delete/i);
  });

  it("keeps storage identity private and validates download ownership and containment", () => {
    expect(routes).not.toMatch(/storageKey:\s*fileObject\.storageKey/);
    expect(routes).not.toMatch(/absolutePath|filesystemPath/);
    expect(routes).toContain("where: { id: params.versionId, documentId: params.id }");
    expect(routes).toContain("version.fileObject.assetType !== " + JSON.stringify("knowledge_document"));
    expect(routes).toContain("readFile(version.fileObject.storageKey)");
    expect(routes).toContain(JSON.stringify("Cache-Control") + ", " + JSON.stringify("private, no-store"));
    expect(routes).toContain(JSON.stringify("X-Content-Type-Options") + ", " + JSON.stringify("nosniff"));
    expect(routes).toContain(".header(" + JSON.stringify("Content-Disposition"));
  });

  it("creates immutable versions safely and cleans a newly written file after database failure", () => {
    expect(routes).toContain("FOR UPDATE");
    expect(routes).toContain("const versionNumber = (previous?.versionNumber ?? 0) + 1");
    expect(routes).toContain("versionNumber,");
    expect(routes).toMatch(/reviewStatus:\s*previous\.reviewStatus\s*===\s*"APPROVED_SOURCE"\s*\?\s*"APPROVED_SOURCE"\s*:\s*"SUPERSEDED"/);
    expect(routes).toContain("await deleteFile(stored.storageKey).catch");
    expect(migration).toContain("KnowledgeVersion_document_version_key");
    expect(migration).toContain("KnowledgeDocumentVersion_fileObjectId_key");
    expect(routes).toContain("DUPLICATE_CHECKSUM");
    expect(routes).toContain("An identical file already exists in private storage.");
  });

  it("keeps archive non-destructive and records all required audit actions", () => {
    expect(routes).toContain("setLifecycle(request, " + JSON.stringify("ARCHIVED") + ")");
    expect(routes).toContain("setLifecycle(request, " + JSON.stringify("ACTIVE") + ")");
    expect(routes).not.toContain("knowledgeDocument.delete");
    expect(routes).not.toContain("fileObject.delete");
    for (const action of [
      "knowledge.document_created",
      "knowledge.file_uploaded",
      "knowledge.version_uploaded",
      "knowledge.metadata_edited",
      "knowledge.file_downloaded",
      "knowledge.document_archived",
      "knowledge.document_restored"
    ]) expect(routes).toContain(action);
  });

  it("keeps navigation and actions permission-aware", () => {
    expect(app).toContain("user.permissions.includes(" + JSON.stringify("knowledge.read") + ")");
    expect(app).toContain("canReadKnowledge ?");
    expect(ui).toContain("permissions.includes(" + JSON.stringify("knowledge.upload") + ")");
    expect(ui).toContain("permissions.includes(" + JSON.stringify("knowledge.edit") + ")");
    expect(ui).toContain("permissions.includes(" + JSON.stringify("knowledge.archive") + ")");
  });

  it("provides validation, filters, versions, scan state, and the AI boundary", () => {
    expect(ui).toContain("new Set([" + ["pdf", "txt", "csv", "png", "jpg", "jpeg", "webp"].map((value) => JSON.stringify(value)).join(", ") + "])");
    expect(ui).toContain("File exceeds the 25 MB upload limit.");
    for (const filter of ["search", "category", "locale", "market", "lifecycle", "fileType", "uploadedFrom", "uploadedTo"]) {
      expect(ui).toContain(filter);
    }
    expect(ui).toContain("Version timeline");
    expect(ui).toContain("Scanner unavailable");
    expect(ui).toContain("Documents in the Knowledge Library are not yet available to AI content generation.");
    expect(ui).not.toContain("window.confirm");
    expect(ui).not.toContain("confirm(");
    expect(css).toContain("@media (max-width: 700px)");
    expect(css).toContain(".knowledge-table thead { display: none; }");
  });
});
