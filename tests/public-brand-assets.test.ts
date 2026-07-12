import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, "public/assets/brand-profile.json"), "utf8"));

describe("public brand asset package", () => {
  it("is configured as the Vite public directory", () => {
    const vite = readFileSync(join(root, "vite.config.ts"), "utf8");
    expect(vite).toContain('publicDir: "../../public"');
  });

  it("contains every asset declared by the manifest", () => {
    const files = [
      ...Object.values(manifest.logos),
      ...Object.values(manifest.products).map((product: any) => product.file)
    ] as string[];
    for (const file of files) expect(existsSync(join(root, "public/assets", file)), file).toBe(true);
  });

  it("keeps profile marketing approvals current", () => {
    expect(manifest.products["sunflower-oil-3l"].approved_for_marketing).toBe(true);
    expect(manifest.products["sunflower-oil-17l"].approved_for_marketing).toBe(true);
  });
});
