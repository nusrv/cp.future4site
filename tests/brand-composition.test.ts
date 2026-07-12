import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
describe("branded image composition pipeline", () => {
  it("generates backgrounds only before deterministic composition", () => {
    const prompt = read("workflows/n8n/code/build-background-prompt.js");
    expect(prompt).toContain("background scene only");
    expect(prompt).toContain("Do not show any product");
  });
  it("resolves only approved assets within the mounted root", () => {
    const resolver = read("workflows/n8n/code/resolve-brand-assets.js");
    expect(resolver).toContain("BRAND_ASSETS_BASE_DIR");
    expect(resolver).toContain("approved_for_marketing");
    expect(resolver).toContain("brand_theme");
    expect(resolver).toContain("layout_rules");
    expect(resolver).toContain("escaped asset root");
  });
  it("uses local mounted assets with Sharp and returns composed JPEG payloads", () => {
    const composer = read("workflows/n8n/code/compose-brand-image.js");
    expect(composer).toContain('require("sharp")');
    expect(composer).toContain('require("fs")');
    expect(composer).not.toContain('require("http")');
    expect(composer).not.toContain('require("https")');
    expect(composer).not.toContain("fetch(");
    expect(composer).toContain('mime_type: "image/jpeg"');
    expect(composer).toContain("data_base64");
    expect(composer).toContain("template_background_path");
    expect(composer).toContain("composed_files");
  });
  it("stores composed callback images as private files", () => {
    const route = read("src/server/routes/automation.ts");
    expect(route).toContain('source === "n8n-sharp-compositor"');
    expect(route).toContain("storedComposition");
    expect(route).toContain("tx.fileObject.create");
  });
});
