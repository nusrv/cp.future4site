import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("media library contract", () => {
  it("registers authenticated gallery and reuse routes", () => {
    const index = read("src/server/index.ts");
    const routes = read("src/server/routes/media.ts");
    expect(index).toContain("mediaRoutes(app)");
    expect(routes).toContain('app.get("/api/media/images"');
    expect(routes).toContain('app.post("/api/media/images"');
    expect(routes).toContain('app.delete("/api/media/images/:id"');
    expect(routes).toContain('app.post("/api/content/requests/:id/assets/select"');
    expect(routes).toContain("generatedAssets");
    expect(routes).toContain("findImageUrl");
    expect(routes).toContain("assetId: z.string().optional()");
    expect(routes).toMatch(/requirePermission\("content\.(read|write)"\)/);
  });

  it("protects images that are actively used by content", () => {
    const routes = read("src/server/routes/media.ts");
    expect(routes).toContain("activeUsageCount");
    expect(routes).toContain("This image is attached to content");
    expect(routes).toContain("status: { notIn: inactiveAssetStatuses }");
  });

  it("keeps reused files when a failed request is deleted", () => {
    const routes = read("src/server/routes/content.ts");
    expect(routes).toContain("sharedFileRefs");
    expect(routes).toContain("deletableFileIds");
    expect(routes).toContain("deleteFile(file.storageKey)");
  });

  it("ships a private image folder without tracking uploaded binaries", () => {
    const storage = read("src/server/services/storage.ts");
    const ignore = read(".gitignore");
    expect(storage).toContain('mimeType.startsWith("image/") ? "images"');
    expect(ignore).toContain("storage/images/*");
    expect(ignore).toContain("!storage/images/.gitkeep");
    expect(existsSync(join(process.cwd(), "storage", "images", ".gitkeep"))).toBe(true);
  });

  it("exposes gallery management and per-post selection in the CP", () => {
    const app = read("src/client/src/ui/App.tsx");
    const studio = read("src/client/src/ui/MarketingStudio.tsx");
    expect(app).toContain('to="/media-library"');
    expect(studio).toContain("Choose from library");
    expect(studio).toContain("MediaLibraryPicker");
  });
});
