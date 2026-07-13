import { describe, expect, it, vi } from "vitest";

vi.mock("../src/server/config.js", () => ({
  config: {
    FILE_STORAGE_DRIVER: "mock",
    FILE_STORAGE_PATH: "./storage",
    MAX_UPLOAD_MB: 25
  }
}));

import { verifyKnowledgeFile } from "../src/server/services/fileVerification";
import { isWithinStorageRoot, saveFile } from "../src/server/services/storage";

const signatures = {
  pdf: Buffer.from("%PDF-1.7\n"),
  txt: Buffer.from("Approved plain text\n", "utf8"),
  csv: Buffer.from("product,capacity\noil,10L\n", "utf8"),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  webp: Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")])
};

const declared = {
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp"
};

describe("Knowledge Library file verification", () => {
  it.each(Object.keys(signatures) as Array<keyof typeof signatures>)("accepts a valid .%s upload", (extension) => {
    const result = verifyKnowledgeFile(signatures[extension], "../Unsafe name " + extension + "." + extension, declared[extension]);
    expect(result.extension).toBe(extension);
    expect(result.originalName).not.toContain("/");
    expect(result.securityStatus).toBe("SCAN_UNAVAILABLE");
  });

  it("rejects disallowed extensions and MIME mismatches", () => {
    expect(() => verifyKnowledgeFile(Buffer.from("PK"), "catalogue.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toThrow("Unsupported file extension");
    expect(() => verifyKnowledgeFile(signatures.pdf, "catalogue.pdf", "image/png")).toThrow("Declared MIME type does not match");
    expect(() => verifyKnowledgeFile(signatures.png, "catalogue.pdf", "application/pdf")).toThrow("Detected file type does not match");
  });

  it("rejects empty, oversized, and binary text files", () => {
    expect(() => verifyKnowledgeFile(Buffer.alloc(0), "empty.txt", "text/plain")).toThrow("empty");
    expect(() => verifyKnowledgeFile(Buffer.alloc(25 * 1024 * 1024 + 1, 0x20), "large.txt", "text/plain")).toThrow("25 MB");
    expect(() => verifyKnowledgeFile(Buffer.from([0x41, 0, 0x42]), "binary.txt", "text/plain")).toThrow("binary content");
  });

  it("enforces the controlled knowledge namespace and opaque storage name", async () => {
    const stored = await saveFile(signatures.pdf, "customer catalogue.pdf", "application/pdf", {
      namespace: "knowledge-base",
      documentId: "doc_safe",
      versionId: "version_safe",
      extension: "pdf"
    });
    expect(stored.storageKey).toMatch(/^mock:\/\/knowledge-base\/\d{4}\/\d{2}\/doc_safe\/version_safe\/[A-Za-z0-9_-]{24}\.pdf$/);
    expect(stored.storageKey).not.toContain("customer");
    await expect(saveFile(signatures.pdf, "x.pdf", "application/pdf", {
      namespace: "knowledge-base",
      documentId: "../escape",
      versionId: "v1",
      extension: "pdf"
    })).rejects.toThrow("Invalid document ID");
    await expect(saveFile(signatures.pdf, "x.pdf", "application/pdf", { namespace: "arbitrary" } as never)).rejects.toThrow("Unsupported storage namespace");
  });

  it("applies Windows containment safely independent of the test host", () => {
    expect(isWithinStorageRoot("C:\\private\\storage", "C:\\private\\storage\\knowledge-base\\file.pdf")).toBe(true);
    expect(isWithinStorageRoot("C:\\private\\storage", "C:\\private\\storage-escape\\file.pdf")).toBe(false);
    expect(isWithinStorageRoot("C:\\private\\storage", "C:\\private\\storage\\knowledge-base\\..\\..\\escape.pdf")).toBe(false);
    expect(isWithinStorageRoot("C:\\private\\storage", "D:\\private\\storage\\file.pdf")).toBe(false);
    expect(isWithinStorageRoot("C:\\private\\storage", "C:\\private\\storage")).toBe(false);
  });

  it("enforces POSIX containment for the Plesk production filesystem", () => {
    expect(isWithinStorageRoot("/srv/private/storage", "/srv/private/storage/knowledge-base/file.pdf")).toBe(true);
    expect(isWithinStorageRoot("/srv/private/storage", "/srv/private/storage-escape/file.pdf")).toBe(false);
    expect(isWithinStorageRoot("/srv/private/storage", "/srv/private/storage/knowledge-base/../../public/file.pdf")).toBe(false);
    expect(isWithinStorageRoot("/srv/private/storage", "/srv/public/file.pdf")).toBe(false);
    expect(isWithinStorageRoot("/srv/private/storage", "/srv/private/storage")).toBe(false);
    expect(isWithinStorageRoot("/srv/private/storage", "C:\\srv\\private\\storage\\file.pdf")).toBe(false);
  });
});
