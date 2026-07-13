import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const routeSource = fs.readFileSync(path.join(root, "src/server/routes/content.ts"), "utf8");
const workflow = JSON.parse(fs.readFileSync(path.join(root, "workflows/n8n/generated/13-facebook-publishing.json"), "utf8"));
const prepareNode = workflow.nodes.find((node: { name?: string }) => node.name === "Prepare Facebook Photo Uploads");

function prepare(payload: Record<string, unknown>) {
  const execute = new Function("$json", "$env", prepareNode.parameters.jsCode);
  return execute(
    { cp: { payload } },
    {
      META_GRAPH_API_VERSION: "v23.0",
      FUTURE_OILS_FACEBOOK_PAGE_ID: "test-page",
      FUTURE_OILS_FACEBOOK_ACCESS_TOKEN: "test-token"
    }
  )[0].json;
}

describe("Facebook publishing message composition", () => {
  it("passes stored hashtags from CP to the publishing workflow", () => {
    const publishRoute = routeSource.slice(routeSource.indexOf("/api/content/items/:id/publish"));
    expect(publishRoute).toContain("hashtags: item.hashtags");
    expect(publishRoute.indexOf("hashtags: item.hashtags")).toBeLessThan(publishRoute.indexOf("createAutomationJob({"));
  });

  it("does not duplicate a CTA already at the end of the caption and appends unique hashtags", () => {
    const result = prepare({
      platform: "facebook",
      dryRun: true,
      caption: "Reliable supply for distributors.\n\nRequest a Quote",
      cta: "Request a Quote",
      hashtags: "#FutureOils #SunflowerOil #FutureOils"
    });

    expect(result.caption).toBe(
      "Reliable supply for distributors.\n\nRequest a Quote\n\n#FutureOils #SunflowerOil"
    );
    expect(result.caption.match(/Request a Quote/g)).toHaveLength(1);
  });

  it("adds a missing CTA and supports hashtag arrays", () => {
    const result = prepare({
      platform: "facebook",
      dryRun: true,
      caption: "Reliable supply for distributors.",
      cta: "Request a Quote",
      hashtags: ["FutureOils", "#B2BSupply"]
    });

    expect(result.caption).toBe(
      "Reliable supply for distributors.\n\nRequest a Quote\n\n#FutureOils #B2BSupply"
    );
  });
});
