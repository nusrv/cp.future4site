import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const workflowDir = join(process.cwd(), "workflows", "n8n");

describe("n8n workflow exports", () => {
  it("keeps every JSON workflow inactive and credential-free", () => {
    const files = readdirSync(workflowDir).filter((file) => file.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const workflow = JSON.parse(readFileSync(join(workflowDir, file), "utf8"));
      expect(workflow.active).toBe(false);
      expect(workflow.credentials).toBeUndefined();
      expect(workflow.nodes?.some((node: any) => node.credentials)).toBe(false);
      expect(JSON.stringify(workflow)).not.toMatch(/access_token|api[_-]?key|password/i);
    }
  });

  it("keeps dry-run publishing disconnected from Meta endpoints", () => {
    const raw = readFileSync(join(workflowDir, "publication-dry-run-draft.json"), "utf8");
    expect(raw).not.toMatch(/graph\.facebook\.com|instagram_oembed|media_publish/i);
    expect(raw).toMatch(/metaCalled/);
  });
});
