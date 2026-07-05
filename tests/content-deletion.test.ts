import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const route = fs.readFileSync(path.join(root, "src/server/routes/content.ts"), "utf8");
const studio = fs.readFileSync(path.join(root, "src/client/src/ui/MarketingStudio.tsx"), "utf8");

describe("content request cleanup", () => {
  it("allows permanent deletion regardless of request or publishing status", () => {
    expect(route).not.toContain("Only failed requests can be permanently deleted");
    expect(route).not.toContain("Requests with publishing history cannot be deleted");
    expect(route).toContain('action: "content.request_deleted"');
  });

  it("clears request, item, asset, publishing, approval, file, and automation associations", () => {
    expect(route).toContain('relatedEntityType: "content_request"');
    expect(route).toContain('relatedEntityType: "content_item"');
    expect(route).toContain("prisma.approval.deleteMany");
    expect(route).toContain("prisma.creativeAsset.deleteMany");
    expect(route).toContain("prisma.fileObject.deleteMany");
    expect(route).toContain("prisma.automationJob.deleteMany");
    expect(route).toContain("prisma.contentRequest.delete");
  });

  it("offers deletion for every workflow stage with an explicit consequence warning", () => {
    expect(studio).toContain("Delete request permanently");
    expect(studio).toContain("Posts already published on Facebook or Instagram are not removed.");
    expect(studio).not.toContain("Delete failed request");
  });
});