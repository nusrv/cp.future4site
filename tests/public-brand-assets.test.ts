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

  it("uses the approved main identity for the CP favicon and brand lockup", () => {
    const html = readFileSync(join(root, "src/client/index.html"), "utf8");
    const app = readFileSync(join(root, "src/client/src/ui/App.tsx"), "utf8");
    const css = readFileSync(join(root, "src/client/src/styles.css"), "utf8");
    expect(existsSync(join(root, "public/assets/logo/main-logo.png"))).toBe(true);
    expect(existsSync(join(root, "public/assets/logo/main-logo-favicon.png"))).toBe(true);
    expect(html).toContain('href="/assets/logo/main-logo-favicon.png"');
    expect(app).toContain('src="/assets/logo/main-logo.png"');
    expect(app).toContain("Internal management");
    expect(app).not.toMatch(/brand-mark[^\n]*>FF</);
    expect(app).not.toContain('className="cp-brand-emblem"');
    expect(css).toContain(".cp-brand-wordmark-frame");
  });
});
